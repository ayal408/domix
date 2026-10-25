using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Services.Implementations;

namespace serverApi.Controllers;

[ApiController, Route("api/exchange"), Authorize]
public class ExchangeController(ApartmentContext context) : ControllerBase
{
    [HttpGet("matches")]
    public async Task<IActionResult> Matches([FromQuery] Guid offeredApartmentId,
        [FromQuery] string destination, [FromQuery] DateOnly start, [FromQuery] DateOnly end,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(destination) || destination.Length > 100 ||
            start < ExchangeMatching.Today || end <= start)
            return BadRequest("יש לבחור יעד ותאריכי כניסה ויציאה תקינים");
        var claim = User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(claim, out var userId)) return Unauthorized();
        var offer = await context.Apartments.AsNoTracking().FirstOrDefaultAsync(
            a => a.ApartmentId == offeredApartmentId && a.UserId == userId, cancellationToken);
        if (offer == null) return NotFound("הדירה המוצעת אינה נמצאת בחשבונך");
        if (!ExchangeMatching.Covers(offer, start, end))
            return BadRequest("הדירה שלך צריכה להיות זמינה להחלפה במשך כל התקופה המבוקשת");
        var city = destination.Trim().ToLower();
        var candidates = await context.Apartments.AsNoTracking().Include(a => a.ApartmentImages)
            .Where(a => a.UserId != userId && a.ListingType == "Exchange" &&
                a.Status == serverApi.Models.ApartmentStatus.Available && a.city.Trim().ToLower() == city &&
                a.AvailableFrom <= start && a.AvailableTo >= end)
            .ToListAsync(cancellationToken);
        var matches = candidates.Select(a => new {
            Apartment = ApartmentService.ToDTO(a),
            IsMutual = ExchangeMatching.SameCity(a.DesiredCity, offer.city)
        }).OrderByDescending(a => a.IsMutual).ThenBy(a => a.Apartment.ApartmentId);
        return Ok(matches);
    }
}
