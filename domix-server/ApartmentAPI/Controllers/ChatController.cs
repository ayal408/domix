using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("chat")]
    public class ChatController : ControllerBase
    {
        private const int MaxTurns = 40;
        private const int MaxTurnLength = 4000;

        private readonly IChatService _chatService;
        private readonly ILogger<ChatController> _logger;
        private readonly JsonSerializerOptions _jsonOptions;

        public ChatController(IChatService chatService, ILogger<ChatController> logger, IOptions<Microsoft.AspNetCore.Mvc.JsonOptions> jsonOptions)
        {
            _chatService = chatService;
            _logger = logger;
            _jsonOptions = jsonOptions.Value.JsonSerializerOptions;
        }

        // ================= STREAM CHAT REPLY =================
        [HttpPost("stream")]
        public async Task StreamReply([FromBody] ChatStreamRequestDto dto, CancellationToken cancellationToken)
        {
            if (dto?.History == null || dto.History.Count == 0)
            {
                Response.StatusCode = StatusCodes.Status400BadRequest;
                await Response.WriteAsync("Invalid request: history is required.", cancellationToken);
                return;
            }

            if (dto.History.Count > MaxTurns || dto.History.Any(t => t.Text.Length > MaxTurnLength))
            {
                Response.StatusCode = StatusCodes.Status400BadRequest;
                await Response.WriteAsync("Invalid request: conversation is too long.", cancellationToken);
                return;
            }

            Response.ContentType = "text/event-stream";
            Response.Headers.CacheControl = "no-cache";

            try
            {
                await foreach (var evt in _chatService.StreamReplyAsync(dto.History, cancellationToken))
                {
                    switch (evt)
                    {
                        case ChatTextChunk textChunk:
                            var payload = textChunk.Text.Replace("\r", "").Replace("\n", "\ndata: ");
                            await Response.WriteAsync($"data: {payload}\n\n", cancellationToken);
                            break;
                        case ChatApartmentResults apartmentResults:
                            var json = JsonSerializer.Serialize(apartmentResults.Apartments, _jsonOptions);
                            await Response.WriteAsync($"event: apartments\ndata: {json}\n\n", cancellationToken);
                            break;
                    }
                    await Response.Body.FlushAsync(cancellationToken);
                }
            }
            catch (OperationCanceledException)
            {
                // Client disconnected or request was canceled — nothing to do.
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while streaming chat reply.");
                if (!Response.HasStarted)
                {
                    Response.StatusCode = StatusCodes.Status500InternalServerError;
                }
            }
        }
    }
}
