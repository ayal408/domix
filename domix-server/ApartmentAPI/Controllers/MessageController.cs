using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;
using System.Security.Claims;

namespace serverApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MessageController : ControllerBase
    {
        private readonly IMessageService _messageService;
        private readonly ILogger<MessageController> _logger;

        public MessageController(IMessageService messageService, ILogger<MessageController> logger)
        {
            _messageService = messageService;
            _logger = logger;
        }

        // ================= SEND MESSAGE =================
        [HttpPost]
        public async Task<IActionResult> SendMessage([FromBody] CreateMessageDto dto, CancellationToken cancellationToken)
        {
            if (dto == null)
                return BadRequest("Invalid request payload.");

            var senderIdClaim = User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (!Guid.TryParse(senderIdClaim, out var senderId))
            {
                return Unauthorized("User identity is invalid.");
            }

            try
            {
                var result = await _messageService.SendMessageAsync(dto, senderId, cancellationToken);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while sending message.");
                return StatusCode(500, "Internal server error occurred.");
            }
        }

        // ================= GET INBOX =================
        [HttpGet("owner/{ownerId}")]
        public async Task<IActionResult> GetOwnerMessages(Guid ownerId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == null || currentUserId != ownerId)
            {
                return Forbid(); // מניעת גישה להודעות של משתמשים אחרים
            }

            var messages = await _messageService.GetOwnerMessagesAsync(ownerId, page, pageSize, cancellationToken);
            return Ok(messages);
        }

        // ================= GET ARCHIVED LIST =================
        [HttpGet("owner/{ownerId}/archived")]
        public async Task<IActionResult> GetArchivedMessages(Guid ownerId, CancellationToken cancellationToken = default)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == null || currentUserId != ownerId)
            {
                return Forbid();
            }

            var messages = await _messageService.GetArchivedMessagesAsync(ownerId, cancellationToken);
            return Ok(messages);
        }

        // ================= ARCHIVE MESSAGE =================
        [HttpPut("archive/{id}")]
        public async Task<IActionResult> Archive(Guid id, CancellationToken cancellationToken = default)
        {
            var ownerId = GetCurrentUserId();
            if (ownerId == null) return Unauthorized();

            var success = await _messageService.ArchiveMessageAsync(id, ownerId.Value, cancellationToken);
            if (!success) return NotFound();

            return Ok();
        }

        // ================= DELETE MESSAGE =================
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMessage(Guid id, CancellationToken cancellationToken = default)
        {
            var ownerId = GetCurrentUserId();
            if (ownerId == null) return Unauthorized();

            var success = await _messageService.DeleteMessageAsync(id, ownerId.Value, cancellationToken);
            if (!success) return NotFound();

            return Ok();
        }

        // ================= MARK AS READ =================
        [HttpPut("read/{id}")]
        public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken = default)
        {
            var ownerId = GetCurrentUserId();
            if (ownerId == null) return Unauthorized();

            var success = await _messageService.MarkAsReadAsync(id, ownerId.Value, cancellationToken);
            if (!success) return NotFound();

            return Ok();
        }

        private Guid? GetCurrentUserId()
        {
            var userIdStr = User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (Guid.TryParse(userIdStr, out var userId))
            {
                return userId;
            }
            return null;
        }
    }
}