using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;
using serverApi.Services.Implementations;

namespace serverApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("chat")]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private const int MaxTurns = 8;
        private const int MaxTurnLength = 2000;

        private readonly IChatService _chatService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<ChatController> _logger;
        private readonly JsonSerializerOptions _jsonOptions;

        public ChatController(IChatService chatService, ILogger<ChatController> logger, IOptions<Microsoft.AspNetCore.Mvc.JsonOptions> jsonOptions, IConfiguration configuration)
        {
            _chatService = chatService;
            _configuration = configuration;
            _logger = logger;
            _jsonOptions = jsonOptions.Value.JsonSerializerOptions;
        }

        [AllowAnonymous, HttpGet("status")]
        public IActionResult Status() => Ok(new { enabled = _configuration.GetValue<bool>("Privacy:ChatEnabled") });

        // ================= STREAM CHAT REPLY =================
        [HttpPost("stream")]
        public async Task StreamReply([FromBody] ChatStreamRequestDto dto, CancellationToken cancellationToken)
        {
            if (!_configuration.GetValue<bool>("Privacy:ChatEnabled"))
            {
                Response.StatusCode = 503;
                await Response.WriteAsJsonAsync(new { code = "CHAT_UNAVAILABLE" }, cancellationToken);
                return;
            }
            if (dto is null || !dto.PrivacyAccepted || !dto.IsAdult)
            {
                Response.StatusCode = 400;
                await Response.WriteAsJsonAsync(new { code = "CHAT_PRIVACY_REQUIRED" }, cancellationToken);
                return;
            }
            if (dto.History == null || dto.History.Count == 0)
            {
                Response.StatusCode = StatusCodes.Status400BadRequest;
                await Response.WriteAsync("Invalid request: history is required.", cancellationToken);
                return;
            }

            if (dto.History.Count > MaxTurns || dto.History.Any(t => t is null || string.IsNullOrWhiteSpace(t.Text) || t.Text.Length > MaxTurnLength || (t.Role != "user" && t.Role != "model")))
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
            catch (ChatUnavailableException)
            {
                Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                await Response.WriteAsJsonAsync(new { code = "CHAT_UNAVAILABLE" }, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while streaming chat reply.");
                if (!Response.HasStarted)
                {
                    Response.StatusCode = StatusCodes.Status502BadGateway;
                    await Response.WriteAsJsonAsync(new { code = "CHAT_UNAVAILABLE" }, cancellationToken);
                }
                else
                {
                    await Response.WriteAsync("event: error\ndata: CHAT_UNAVAILABLE\n\n", cancellationToken);
                    await Response.Body.FlushAsync(cancellationToken);
                }
            }
        }
    }
}
