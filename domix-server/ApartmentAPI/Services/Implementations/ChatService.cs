using System.Text.Json;
using System.Text.Json.Nodes;
using Google.GenAI;
using Google.GenAI.Types;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    public class ChatService : IChatService
    {
        // gemini-2.5-flash still lists in the API's models catalog but 404s on generateContent for
        // this project ("no longer available to new users") — Google's own error names this as the
        // replacement; verified directly against the Generative Language API before switching.
        private const string Model = "gemini-3.6-flash";

        private const string SystemPrompt =
            "You are the DOMIX site assistant, a short-answer helper embedded in a real-estate " +
            "listings website. DOMIX lets visitors browse apartment listings with filters (city, " +
            "area, price, rooms, property type), view listing details and a map of listings, save " +
            "favorites, compare up to 4 listings side by side, save searches for alerts, message " +
            "listing owners directly, and use a mortgage calculator that shows monthly payment and " +
            "an amortization schedule. Signed-in users manage their own listings, account, and " +
            "saved searches. Answer only questions about using the DOMIX site, real estate concepts " +
            "relevant to it (e.g. mortgages, listing terms), or general pleasantries. Keep answers " +
            "brief and concrete. Never invent specific listing data, prices, or user information you " +
            "were not given — say you don't have access to it instead. If asked something unrelated " +
            "to the site, say briefly that you can only help with DOMIX-related questions. " +
            "When the user describes what kind of apartment they want (city, price range, rooms, " +
            "property type, parking, elevator, etc.), call the search_apartments function with the " +
            "filters you can infer instead of guessing at listings yourself. The UI already renders " +
            "the results as cards, so after the call keep your reply to a short one- or two-sentence " +
            "intro — do not repeat every result back as text.";

        private const int MaxChatSearchResults = 8;

        private static readonly Tool SearchTool = new()
        {
            FunctionDeclarations = new List<FunctionDeclaration>
            {
                new()
                {
                    Name = "search_apartments",
                    Description = "Searches DOMIX's available apartment listings by filters. Returns matching listings.",
                    ParametersJsonSchema = JsonNode.Parse(
                        """
                        {
                          "type": "object",
                          "properties": {
                            "city": { "type": "string", "description": "City name, e.g. Tel Aviv" },
                            "area": { "type": "string", "description": "Neighborhood or area within the city" },
                            "minPrice": { "type": "integer", "description": "Minimum price" },
                            "maxPrice": { "type": "integer", "description": "Maximum price" },
                            "minRooms": { "type": "integer", "description": "Minimum number of rooms" },
                            "maxRooms": { "type": "integer", "description": "Maximum number of rooms" },
                            "propertyType": {
                              "type": "string",
                              "enum": ["Apartment", "House", "Studio", "Penthouse", "Garden", "Duplex", "Other"]
                            },
                            "parking": { "type": "boolean" },
                            "elevator": { "type": "boolean" }
                          }
                        }
                        """),
                },
            },
        };

        private readonly Client _client;
        private readonly IApartmentService _apartmentService;
        private readonly ILogger<ChatService> _logger;

        public ChatService(IConfiguration configuration, IApartmentService apartmentService, ILogger<ChatService> logger)
        {
            var apiKey = System.Environment.GetEnvironmentVariable("GEMINI_API_KEY");
            if (string.IsNullOrWhiteSpace(apiKey))
                throw new InvalidOperationException("Configuration Error: GEMINI_API_KEY is not set.");

            _client = new Client(apiKey: apiKey);
            _apartmentService = apartmentService;
            _logger = logger;
        }

        public async IAsyncEnumerable<ChatStreamEvent> StreamReplyAsync(
            IReadOnlyList<ChatTurnDto> history,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var contents = history
                .Select(turn => new Content
                {
                    Role = turn.Role,
                    Parts = new List<Part> { new Part { Text = turn.Text } }
                })
                .ToList();

            Part? functionCallPart = null;

            await foreach (var evt in RunModelAsync(contents, useTools: true, cancellationToken))
            {
                if (evt is TextEvent text)
                {
                    yield return new ChatTextChunk(text.Text);
                }
                else if (evt is FunctionCallEvent fc)
                {
                    functionCallPart = fc.Part;
                    break;
                }
            }

            if (functionCallPart?.FunctionCall == null)
            {
                yield break;
            }

            var functionCall = functionCallPart.FunctionCall;

            IReadOnlyList<Models.DTOs.ApartmentDTO> results;
            try
            {
                results = await RunSearchAsync(functionCall, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "search_apartments tool execution failed.");
                results = Array.Empty<Models.DTOs.ApartmentDTO>();
            }

            yield return new ChatApartmentResults(results);

            contents.Add(new Content
            {
                Role = "model",
                Parts = new List<Part> { functionCallPart },
            });
            contents.Add(new Content
            {
                Role = "user",
                Parts = new List<Part>
                {
                    new Part
                    {
                        FunctionResponse = new FunctionResponse
                        {
                            Name = functionCall.Name,
                            Response = BuildFunctionResponsePayload(results),
                        },
                    },
                },
            });

            await foreach (var evt in RunModelAsync(contents, useTools: false, cancellationToken))
            {
                if (evt is TextEvent text)
                {
                    yield return new ChatTextChunk(text.Text);
                }
            }
        }

        /// <summary>Internal union of what a single Gemini streaming pass can produce — either
        /// text chunks, or (only when tools are enabled) a function call that ends the pass.</summary>
        private abstract class ModelStreamEvent
        {
        }

        private sealed class TextEvent : ModelStreamEvent
        {
            public string Text { get; }
            public TextEvent(string text) => Text = text;
        }

        private sealed class FunctionCallEvent : ModelStreamEvent
        {
            /// <summary>The whole Part, not just the FunctionCall — Gemini 3's "thinking" models
            /// attach an opaque ThoughtSignature to the Part that must be echoed back verbatim
            /// alongside the function call in the next turn, or the API rejects the request.</summary>
            public Part Part { get; }
            public FunctionCallEvent(Part part) => Part = part;
        }

        private async IAsyncEnumerable<ModelStreamEvent> RunModelAsync(
            List<Content> contents,
            bool useTools,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
        {
            var config = new GenerateContentConfig
            {
                SystemInstruction = new Content
                {
                    Parts = new List<Part> { new Part { Text = SystemPrompt } }
                },
                Tools = useTools ? new List<Tool> { SearchTool } : null,
            };

            IAsyncEnumerator<GenerateContentResponse> stream;
            try
            {
                stream = _client.Models
                    .GenerateContentStreamAsync(model: Model, contents: contents, config: config)
                    .GetAsyncEnumerator(cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to start Gemini chat stream.");
                throw;
            }

            await using (stream)
            {
                while (true)
                {
                    GenerateContentResponse chunk;
                    try
                    {
                        if (!await stream.MoveNextAsync())
                            break;
                        chunk = stream.Current;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Gemini chat stream failed mid-response.");
                        throw;
                    }

                    var part = chunk.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault();
                    if (part?.FunctionCall != null)
                    {
                        yield return new FunctionCallEvent(part);
                        yield break;
                    }

                    if (!string.IsNullOrEmpty(part?.Text))
                    {
                        yield return new TextEvent(part.Text);
                    }
                }
            }
        }

        private async Task<IReadOnlyList<Models.DTOs.ApartmentDTO>> RunSearchAsync(FunctionCall call, CancellationToken cancellationToken)
        {
            var args = call.Args;

            object? Get(string key) => args != null && args.TryGetValue(key, out var value) ? value : null;

            string? GetString(string key) => Get(key) switch
            {
                null => null,
                JsonElement je => je.ValueKind == JsonValueKind.String ? je.GetString() : je.ToString(),
                var v => v.ToString(),
            };

            int? GetInt(string key) => Get(key) switch
            {
                null => null,
                JsonElement je => je.GetInt32(),
                var v => Convert.ToInt32(v),
            };

            bool? GetBool(string key) => Get(key) switch
            {
                null => null,
                JsonElement je => je.GetBoolean(),
                var v => Convert.ToBoolean(v),
            };

            var results = await _apartmentService.SearchApartmentsAsync(
                city: GetString("city"),
                area: GetString("area"),
                minPrice: GetInt("minPrice"),
                maxPrice: GetInt("maxPrice"),
                minRooms: GetInt("minRooms"),
                maxRooms: GetInt("maxRooms"),
                propertyType: GetString("propertyType"),
                parking: GetBool("parking"),
                elevator: GetBool("elevator"),
                sortBy: null,
                cancellationToken: cancellationToken);

            return results.Take(MaxChatSearchResults).ToList();
        }

        /// <summary>Compact summary fed back to the model — full listing data (images, ids, etc.)
        /// is unnecessary token cost since the UI already renders the real cards from
        /// <see cref="ChatApartmentResults"/> separately.</summary>
        private static Dictionary<string, object> BuildFunctionResponsePayload(IReadOnlyList<Models.DTOs.ApartmentDTO> results)
        {
            var listings = results.Select(apartment => new Dictionary<string, object?>
            {
                ["city"] = apartment.city,
                ["area"] = apartment.area,
                ["price"] = apartment.price,
                ["rooms"] = apartment.SumOfRooms,
                ["propertyType"] = apartment.PropertyType,
            }).ToList();

            return new Dictionary<string, object>
            {
                ["count"] = results.Count,
                ["listings"] = listings,
            };
        }
    }
}
