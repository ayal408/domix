using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ApartmentController : ControllerBase
    {
        private readonly IApartmentService _apartmentService;
        private readonly ILogger<ApartmentController> _logger;

        public ApartmentController(IApartmentService apartmentService, ILogger<ApartmentController> logger)
        {
            _apartmentService = apartmentService;
            _logger = logger;
        }

        // GET: api/Apartment/all
        [HttpGet("all")]
        public async Task<IActionResult> GetAllApartments(CancellationToken cancellationToken)
        {
            var result = await _apartmentService.GetAllApartmentsAsync(cancellationToken);
            return Ok(result);
        }

        // GET: api/Apartment/cities
        [HttpGet("cities")]
        public async Task<ActionResult<IEnumerable<string>>> GetCities(CancellationToken cancellationToken)
        {
            var result = await _apartmentService.GetCitiesAsync(cancellationToken);
            return Ok(result);
        }

        // GET: api/Apartment/Search
        [HttpGet("Search")]
        public async Task<ActionResult<IEnumerable<ApartmentDTO>>> Search(
            [FromQuery] string? city,
            [FromQuery] string? area,
            [FromQuery] int? minPrice,
            [FromQuery] int? maxPrice,
            [FromQuery] int? minRooms,
            [FromQuery] int? maxRooms,
            [FromQuery] string? propertyType,
            [FromQuery] bool? parking,
            [FromQuery] bool? elevator,
            [FromQuery] string? sortBy,
            CancellationToken cancellationToken)
        {
            var result = await _apartmentService.SearchApartmentsAsync(
                city, area, minPrice, maxPrice, minRooms, maxRooms, propertyType, parking, elevator, sortBy, cancellationToken);
            return Ok(result);
        }

        // POST: api/Apartment
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateApartmentDTO dto, CancellationToken cancellationToken)
        {
            if (dto == null)
                return BadRequest("Invalid request payload.");

            if (string.IsNullOrWhiteSpace(dto.city) ||
                string.IsNullOrWhiteSpace(dto.address) ||
                string.IsNullOrWhiteSpace(dto.area) ||
                dto.price <= 0)
            {
                return BadRequest("Missing required fields: city, address, area, or price.");
            }

            var userIdClaim = User.FindFirst("userId")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (!Guid.TryParse(userIdClaim, out var userId))
            {
                _logger.LogWarning("Unauthorized apartment creation attempt: Invalid or missing user ID claim.");
                return Unauthorized("User identity is invalid.");
            }

            var result = await _apartmentService.CreateApartmentAsync(dto, userId, cancellationToken);
            return Ok(result);
        }

        // PUT: api/Apartment/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateApartmentDTO dto, CancellationToken cancellationToken)
        {
            if (dto == null)
                return BadRequest("Invalid request payload.");

            if (string.IsNullOrWhiteSpace(dto.city) ||
                string.IsNullOrWhiteSpace(dto.address) ||
                string.IsNullOrWhiteSpace(dto.area) ||
                dto.price <= 0)
            {
                return BadRequest("Missing required fields: city, address, area, or price.");
            }

            var userIdClaim = User.FindFirst("userId")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (!Guid.TryParse(userIdClaim, out var userId))
            {
                _logger.LogWarning("Unauthorized apartment update attempt: Invalid or missing user ID claim.");
                return Unauthorized("User identity is invalid.");
            }

            var isPrivileged = IsPrivileged();

            try
            {
                var result = await _apartmentService.UpdateApartmentAsync(id, dto, userId, isPrivileged, cancellationToken);
                if (result == null)
                    return NotFound();

                return Ok(result);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
        }

        // DELETE: api/Apartment/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
        {
            var userIdClaim = User.FindFirst("userId")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (!Guid.TryParse(userIdClaim, out var userId))
            {
                _logger.LogWarning("Unauthorized apartment delete attempt: Invalid or missing user ID claim.");
                return Unauthorized("User identity is invalid.");
            }

            var isPrivileged = IsPrivileged();

            try
            {
                var result = await _apartmentService.DeleteApartmentAsync(id, userId, isPrivileged, cancellationToken);
                if (result == null)
                    return NotFound();

                return NoContent();
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
            {
                // Most likely a Restrict FK (e.g. existing Appointments) blocking the delete.
                _logger.LogWarning(ex, "Failed to delete apartment {ApartmentId}: it is still referenced by related records.", id);
                return Conflict("This apartment cannot be deleted while related records (e.g. appointments) still reference it.");
            }
        }

        // POST: api/Apartment/{id}/rate
        [HttpPost("{id}/rate")]
        public async Task<IActionResult> Rate(Guid id, [FromBody] RateApartmentDTO dto, CancellationToken cancellationToken)
        {
            if (dto == null || dto.Score < 1 || dto.Score > 5)
                return BadRequest("Score must be between 1 and 5.");

            var userIdClaim = User.FindFirst("userId")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (!Guid.TryParse(userIdClaim, out var userId))
            {
                _logger.LogWarning("Unauthorized apartment rating attempt: Invalid or missing user ID claim.");
                return Unauthorized("User identity is invalid.");
            }

            try
            {
                var result = await _apartmentService.RateApartmentAsync(id, userId, dto.Score, cancellationToken);
                if (result == null)
                    return NotFound();

                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Admin/Manager may act on listings they don't own; regular users may only act on their own.</summary>
        private bool IsPrivileged() => User.IsInRole("Admin") || User.IsInRole("Manager");
    }
}