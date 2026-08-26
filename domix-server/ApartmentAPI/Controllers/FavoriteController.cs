using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using serverApi.Services.Interfaces;
using System.Security.Claims;

namespace serverApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FavoriteController : ControllerBase
    {
        private readonly IFavoriteService _favoriteService;
        private readonly ILogger<FavoriteController> _logger;

        public FavoriteController(IFavoriteService favoriteService, ILogger<FavoriteController> logger)
        {
            _favoriteService = favoriteService;
            _logger = logger;
        }

        // GET: api/Favorite
        [HttpGet]
        public async Task<IActionResult> GetFavorites(CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User identity is invalid.");

            var result = await _favoriteService.GetFavoritesAsync(userId.Value, cancellationToken);
            return Ok(result);
        }

        // POST: api/Favorite/{apartmentId}
        [HttpPost("{apartmentId}")]
        public async Task<IActionResult> AddFavorite(Guid apartmentId, CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User identity is invalid.");

            var result = await _favoriteService.AddFavoriteAsync(userId.Value, apartmentId, cancellationToken);
            if (result == null)
                return NotFound();

            return Ok(result);
        }

        // DELETE: api/Favorite/{apartmentId}
        [HttpDelete("{apartmentId}")]
        public async Task<IActionResult> RemoveFavorite(Guid apartmentId, CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized("User identity is invalid.");

            var removed = await _favoriteService.RemoveFavoriteAsync(userId.Value, apartmentId, cancellationToken);
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
