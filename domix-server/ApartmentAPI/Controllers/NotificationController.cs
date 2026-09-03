using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationController : ControllerBase
    {
        private readonly INotificationService _notificationService;
        private readonly ILogger<NotificationController> _logger;

        public NotificationController(INotificationService notificationService, ILogger<NotificationController> logger)
        {
            _notificationService = notificationService;
            _logger = logger;
        }

        // GET: api/Notification
        [HttpGet]
        public async Task<IActionResult> GetFeed(CancellationToken cancellationToken)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { code = "Missing or invalid userId claim" });

            var feed = await _notificationService.GetFeedAsync(userId.Value, cancellationToken);
            return Ok(feed);
        }

        // POST: api/Notification/mark-seen
        [HttpPost("mark-seen")]
        public async Task<IActionResult> MarkSeen(CancellationToken cancellationToken)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { code = "Missing or invalid userId claim" });

            await _notificationService.MarkSeenAsync(userId.Value, cancellationToken);
            return NoContent();
        }

        // POST: api/Notification
        [Authorize(Policy = "ManagerOrAdmin")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateNotificationDto dto, CancellationToken cancellationToken)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { code = "Missing or invalid userId claim" });

            try
            {
                var result = await _notificationService.CreateAsync(dto, userId.Value, cancellationToken);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { code = "INVALID_REQUEST", message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create notification.");
                return StatusCode(500, "Internal server error.");
            }
        }

        private Guid? GetUserId()
        {
            var claim = User.FindFirst("userId")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(claim, out var id) ? id : null;
        }
    }
}
