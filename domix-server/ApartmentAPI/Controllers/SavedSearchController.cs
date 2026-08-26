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
    public class SavedSearchController : ControllerBase
    {
        private readonly ISavedSearchService _savedSearchService;
        private readonly ILogger<SavedSearchController> _logger;

        public SavedSearchController(ISavedSearchService savedSearchService, ILogger<SavedSearchController> logger)
        {
            _savedSearchService = savedSearchService;
            _logger = logger;
        }

        // GET: api/SavedSearch
        [HttpGet]
        public async Task<IActionResult> GetSavedSearches(CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User identity is invalid.");

            var result = await _savedSearchService.GetForUserAsync(userId.Value, cancellationToken);
            return Ok(result);
        }

        // POST: api/SavedSearch
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateSavedSearchDTO dto, CancellationToken cancellationToken)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("A name is required for a saved search.");

            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User identity is invalid.");

            var result = await _savedSearchService.CreateAsync(userId.Value, dto, cancellationToken);
            return Ok(result);
        }

        // DELETE: api/SavedSearch/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User identity is invalid.");

            var removed = await _savedSearchService.DeleteAsync(userId.Value, id, cancellationToken);
            if (!removed)
                return NotFound();

            return NoContent();
        }

        private Guid? GetCurrentUserId()
        {
            var userIdStr = User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(userIdStr, out var userId) ? userId : null;
        }
    }
}
