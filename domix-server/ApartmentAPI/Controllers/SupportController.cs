using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Controllers
{
    /// <summary>
    /// "Ask the team" tickets escalated from the chat widget. <see cref="Create"/> is open to
    /// anonymous visitors (same access level as ChatController); listing and resolving are
    /// restricted to Manager/Admin — this is the admin support inbox.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class SupportController : ControllerBase
    {
        private readonly ISupportService _supportService;
        private readonly ILogger<SupportController> _logger;

        public SupportController(ISupportService supportService, ILogger<SupportController> logger)
        {
            _supportService = supportService;
            _logger = logger;
        }

        // POST: api/Support
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateSupportTicketDto dto, CancellationToken cancellationToken)
        {
            if (dto == null)
                return BadRequest("Invalid request payload.");

            var userIdClaim = User.FindFirst("userId")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            Guid? userId = Guid.TryParse(userIdClaim, out var parsed) ? parsed : null;

            try
            {
                var result = await _supportService.CreateAsync(dto, userId, cancellationToken);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { code = "INVALID_REQUEST", message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create support ticket.");
                return StatusCode(500, "Internal server error.");
            }
        }

        // GET: api/Support
        [Authorize(Policy = "ManagerOrAdmin")]
        [HttpGet]
        public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
        {
            var result = await _supportService.GetAllAsync(cancellationToken);
            return Ok(result);
        }

        // PATCH: api/Support/{id}/resolve
        [Authorize(Policy = "ManagerOrAdmin")]
        [HttpPatch("{id}/resolve")]
        public async Task<IActionResult> Resolve(Guid id, CancellationToken cancellationToken)
        {
            var result = await _supportService.ResolveAsync(id, cancellationToken);
            return result == null ? NotFound() : Ok(result);
        }
    }
}
