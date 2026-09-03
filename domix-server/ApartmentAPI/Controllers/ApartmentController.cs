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
        private readonly IConfiguration _configuration;
        private readonly ILogger<ApartmentController> _logger;

        public ApartmentController(IApartmentService apartmentService, IConfiguration configuration, ILogger<ApartmentController> logger)
        {
            _apartmentService = apartmentService;
            _configuration = configuration;
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

        // PATCH: api/Apartment/{id}/status
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> SetStatus(Guid id, [FromBody] SetApartmentStatusDTO dto, CancellationToken cancellationToken)
        {
            if (dto == null)
                return BadRequest("Invalid request payload.");

            var userIdClaim = User.FindFirst("userId")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (!Guid.TryParse(userIdClaim, out var userId))
            {
                _logger.LogWarning("Unauthorized apartment status change attempt: Invalid or missing user ID claim.");
                return Unauthorized("User identity is invalid.");
            }

            try
            {
                var result = await _apartmentService.SetApartmentStatusAsync(id, dto.Status, userId, IsPrivileged(), cancellationToken);
                if (result == null)
                    return NotFound();

                return Ok(result);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
        }

        // GET: api/Apartment/{id}/og
        /// <summary>
        /// A tiny anonymous HTML page carrying Open Graph tags for one listing — nginx routes social
        /// crawlers (WhatsApp, Facebook, etc.) here for /apartments/{id} instead of the SPA shell,
        /// since those bots read og:* meta tags but don't execute JS. Real visitors never see this;
        /// they get the normal React app from the same nginx location for every other User-Agent.
        /// </summary>
        [AllowAnonymous]
        [HttpGet("{id}/og")]
        public async Task<IActionResult> GetOgPreview(Guid id, CancellationToken cancellationToken)
        {
            var apartment = await _apartmentService.GetApartmentByIdAsync(id, cancellationToken);
            if (apartment == null)
                return NotFound();

            var clientAppUrl = (_configuration["CLIENT_APP_URL"] ?? "http://localhost").TrimEnd('/');
            var listingUrl = $"{clientAppUrl}/apartments/{id}";

            var title = $"{apartment.price:N0} ₪ · {apartment.city}, {apartment.area}";
            var descriptionParts = new List<string>();
            if (apartment.SumOfRooms is int rooms) descriptionParts.Add($"{rooms} rooms");
            if (apartment.SquareMeters is int sqm) descriptionParts.Add($"{sqm} m²");
            descriptionParts.Add(apartment.address);
            var description = string.Join(" · ", descriptionParts);

            var imageUrl = apartment.ApartmentImages?.FirstOrDefault()?.ImageUrl;
            var absoluteImageUrl = string.IsNullOrEmpty(imageUrl) ? null : $"{clientAppUrl}{imageUrl}";

            string Enc(string value) => System.Net.WebUtility.HtmlEncode(value);

            var imageTag = absoluteImageUrl != null
                ? $"""<meta property="og:image" content="{Enc(absoluteImageUrl)}"><meta name="twitter:card" content="summary_large_image">"""
                : """<meta name="twitter:card" content="summary">""";

            var html = $"""
                <!DOCTYPE html>
                <html>
                <head>
                <meta charset="utf-8">
                <title>{Enc(title)} | DOMIX</title>
                <meta property="og:type" content="website">
                <meta property="og:title" content="{Enc(title)}">
                <meta property="og:description" content="{Enc(description)}">
                <meta property="og:url" content="{Enc(listingUrl)}">
                <meta property="og:site_name" content="DOMIX">
                {imageTag}
                </head>
                <body>
                <p><a href="{Enc(listingUrl)}">View this listing on DOMIX</a></p>
                </body>
                </html>
                """;

            return Content(html, "text/html");
        }

        /// <summary>Admin/Manager may act on listings they don't own; regular users may only act on their own.</summary>
        private bool IsPrivileged() => User.IsInRole("Admin") || User.IsInRole("Manager");
    }
}