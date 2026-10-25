using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;

namespace serverApi.Controllers;

[ApiController, Route("api/exchange"), Authorize]
public class ExchangeController(ApartmentContext context) : ControllerBase
{
    [HttpGet("matches")]
    public async Task<IActionResult> Matches([FromQuery] Guid offeredApartmentId,
        [FromQuery] string destination, [FromQuery] DateOnly start, [FromQuery] DateOnly end,
        CancellationToken cancellationToken, [FromQuery] int guests = 0, [FromQuery] bool kosherKitchen = false,
        [FromQuery] bool separateBeds = false, [FromQuery] int? maxSynagogueDistance = null)
    {
        // Keep the existing parameter shape for callers; the shared search is also used by opt-in alerts.
        try {
            var (offer, homes) = await ExchangeSearch.Find(context, CurrentUser, new ExchangeWatchDto {
                OfferedApartmentId = offeredApartmentId, Destination = destination, Start = start, End = end,
                Guests = guests, KosherKitchen = kosherKitchen, SeparateBeds = separateBeds, MaxSynagogueDistance = maxSynagogueDistance
            }, cancellationToken);
            return Ok(homes.Select(home => new { Apartment = ApartmentService.ToDTO(home), IsMutual = ExchangeMatching.SameCity(home.DesiredCity, offer.city) })
                .OrderByDescending(x => x.IsMutual).ThenBy(x => x.Apartment.ApartmentId));
        }
        catch (ExchangeForbidden) { return Forbid(); }
        catch (KeyNotFoundException) { return NotFound("הדירה אינה נמצאת בחשבונך"); }
        catch (ArgumentException ex) { return BadRequest(ex.Message); }
        catch (ExchangeConflict ex) { return BadRequest(ex.Message); }
    }
    private Guid CurrentUser => Guid.TryParse(User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : throw new ExchangeForbidden();

    private async Task<IActionResult> Execute(Func<Task<IActionResult>> operation)
    {
        try { return await context.Database.CreateExecutionStrategy().ExecuteAsync(async () => {
            context.ChangeTracker.Clear();
            return await operation();
        }); }
        catch (ExchangeForbidden) { return Forbid(); }
        catch (KeyNotFoundException) { return NotFound(new { message = "הפריט אינו נמצא בחשבונך" }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (ExchangeConflict ex) { return Conflict(new { message = ex.Message }); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "הבקשה השתנתה. יש לרענן את המסך" }); }
        catch (DbUpdateException) { return Conflict(new { message = "הפעולה כבר נשמרה או השתנתה. יש לרענן את המסך" }); }
    }
    [HttpGet("requests")]
    public Task<IActionResult> Requests(CancellationToken ct) => Execute(async () => {
        var user = CurrentUser;
        var requests = await context.ExchangeAgreements.AsNoTracking().Where(x => x.RequesterId == user || x.RecipientId == user)
            .OrderByDescending(x => x.UpdatedAt).ToListAsync(ct);
        var reviews = await context.ExchangeReviews.Where(x => x.ReviewerId == user).Select(x => x.AgreementId).ToListAsync(ct);
        foreach (var request in requests) request.HasReviewed = reviews.Contains(request.Id);
        return Ok(requests);
    });
    [HttpPost("requests")]
    public Task<IActionResult> Create(CreateExchangeAgreementDto dto, CancellationToken ct) => Execute(async () =>
        Ok(await new ExchangeWorkflow(context).Create(CurrentUser, dto, ct)));
    [HttpPost("requests/{id:guid}/decision")]
    public Task<IActionResult> Decide(Guid id, ExchangeDecisionDto dto, CancellationToken ct) => Execute(async () =>
        Ok(await new ExchangeWorkflow(context).Decide(id, CurrentUser, dto, ct)));
    [HttpPost("requests/{id:guid}/counter")]
    public Task<IActionResult> Counter(Guid id, ExchangeCounterDto dto, CancellationToken ct) => Execute(async () =>
        Ok(await new ExchangeWorkflow(context).Counter(id, CurrentUser, dto, ct)));
    [HttpGet("calendar/{apartmentId:guid}")]
    public Task<IActionResult> Calendar(Guid apartmentId, CancellationToken ct) => Execute(async () => {
        if (!await context.Apartments.AnyAsync(x => x.ApartmentId == apartmentId && x.UserId == CurrentUser, ct)) throw new ExchangeForbidden();
        return Ok(new {
            Periods = await context.ExchangeCalendarPeriods.AsNoTracking().Where(x => x.ApartmentId == apartmentId).OrderBy(x => x.Start).ToListAsync(ct),
            Reservations = await context.ExchangeAgreements.AsNoTracking().Where(x => x.Status == "Accepted" && (x.OfferedApartmentId == apartmentId || x.RequestedApartmentId == apartmentId))
                .Select(x => new { x.Id, x.Start, x.End }).ToListAsync(ct)
        });
    });
    [HttpPost("calendar/{apartmentId:guid}")]
    public Task<IActionResult> AddPeriod(Guid apartmentId, CalendarPeriodDto dto, CancellationToken ct) => Execute(async () =>
        Ok(await new ExchangeWorkflow(context).AddPeriod(apartmentId, CurrentUser, dto, ct)));
    [HttpDelete("calendar/periods/{periodId:guid}")]
    public Task<IActionResult> RemovePeriod(Guid periodId, CancellationToken ct) => Execute(async () => {
        await new ExchangeWorkflow(context).RemovePeriod(periodId, CurrentUser, ct); return NoContent();
    });

    [HttpGet("blocks")]
    public Task<IActionResult> Blocks(CancellationToken ct) => Execute(async () => Ok(await context.ExchangeUserBlocks.AsNoTracking().Where(x => x.UserId == CurrentUser).Select(x => new {
        x.Id, x.BlockedUserId, x.CreatedAt,
        DisplayName = context.Apartments.Any(a => a.UserId == x.BlockedUserId && !a.IsAnonymous) ? context.Users.Where(u => u.UserId == x.BlockedUserId).Select(u => u.UserName).FirstOrDefault() : "מפרסם אנונימי"
    }).ToListAsync(ct)));
    [HttpPost("blocks/{userId:guid}")]
    public Task<IActionResult> Block(Guid userId, CancellationToken ct) => Execute(async () => {
        if (userId == CurrentUser || !await context.Users.AnyAsync(x => x.UserId == userId, ct)) throw new ArgumentException("משתמש לא תקין");
        if (!await context.ExchangeUserBlocks.AnyAsync(x => x.UserId == CurrentUser && x.BlockedUserId == userId, ct)) {
            context.ExchangeUserBlocks.Add(new serverApi.Models.ExchangeUserBlock { Id = Guid.NewGuid(), UserId = CurrentUser, BlockedUserId = userId });
            await context.SaveChangesAsync(ct);
        }
        return NoContent();
    });
    [HttpDelete("blocks/{userId:guid}")]
    public Task<IActionResult> Unblock(Guid userId, CancellationToken ct) => Execute(async () => {
        var block = await context.ExchangeUserBlocks.SingleOrDefaultAsync(x => x.UserId == CurrentUser && x.BlockedUserId == userId, ct);
        if (block != null) { context.ExchangeUserBlocks.Remove(block); await context.SaveChangesAsync(ct); }
        return NoContent();
    });
    [HttpPost("reports")]
    public Task<IActionResult> Report(ExchangeReportDto dto, CancellationToken ct) => Execute(async () => {
        if (string.IsNullOrWhiteSpace(dto.Reason)) throw new ArgumentException("יש לפרט את סיבת הדיווח");
        if (!await context.Apartments.AnyAsync(x => x.ApartmentId == dto.ApartmentId, ct)) throw new KeyNotFoundException();
        context.SupportTickets.Add(new serverApi.Models.SupportTicket { SupportTicketId = Guid.NewGuid(), UserId = CurrentUser,
            Message = $"דיווח על מודעה {dto.ApartmentId}: {dto.Reason.Trim()}" });
        await context.SaveChangesAsync(ct); return Ok(new { saved = true });
    });
    [HttpGet("reviews/{userId:guid}")]
    public Task<IActionResult> Reviews(Guid userId, CancellationToken ct) => Execute(async () => Ok(await context.ExchangeReviews.AsNoTracking()
        .Where(x => x.ReviewedUserId == userId).OrderByDescending(x => x.CreatedAt)
        .Select(x => new { x.Id, x.Score, x.Comment, x.CreatedAt }).Take(50).ToListAsync(ct)));
    [HttpPost("requests/{id:guid}/review")]
    public Task<IActionResult> Review(Guid id, ExchangeReviewDto dto, CancellationToken ct) => Execute(async () => {
        if (dto.Score < 1 || dto.Score > 5 || dto.Comment.Length > 1000) throw new ArgumentException("פרטי הביקורת אינם תקינים");
        var user = CurrentUser;
        var request = await context.ExchangeAgreements.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && (x.RequesterId == user || x.RecipientId == user), ct) ?? throw new KeyNotFoundException();
        if (request.Status != "Completed" || request.End > ExchangeMatching.Today) throw new ExchangeConflict("אפשר לכתוב ביקורת רק לאחר ששני הצדדים אישרו שההחלפה הושלמה");
        if (await context.ExchangeReviews.AnyAsync(x => x.AgreementId == id && x.ReviewerId == user, ct)) throw new ExchangeConflict("כבר כתבת ביקורת להחלפה הזו");
        context.ExchangeReviews.Add(new serverApi.Models.ExchangeReview { Id = Guid.NewGuid(), AgreementId = id, ReviewerId = user,
            ReviewedUserId = request.RequesterId == user ? request.RecipientId : request.RequesterId, Score = dto.Score, Comment = dto.Comment.Trim() });
        await context.SaveChangesAsync(ct); return Ok(new { saved = true });
    });

    [HttpGet("watches")]
    public Task<IActionResult> Watches(CancellationToken ct) => Execute(async () => Ok(await context.ExchangeWatches.AsNoTracking().Where(x => x.UserId == CurrentUser)
        .Select(x => new { x.Id, x.OfferedApartmentId, x.Destination, x.Start, x.End, x.Guests, x.KosherKitchen, x.SeparateBeds, x.MaxSynagogueDistance, x.Frequency }).ToListAsync(ct)));
    [HttpPost("watches")]
    public Task<IActionResult> SaveWatch(ExchangeWatchDto dto, CancellationToken ct) => Execute(async () => {
        if (dto.Frequency is not ("Off" or "Immediate" or "Daily" or "Weekly")) throw new ArgumentException("תדירות לא תקינה");
        var user = CurrentUser;
        var (_, homes) = await ExchangeSearch.Find(context, user, dto, ct);
        var watch = await context.ExchangeWatches.SingleOrDefaultAsync(x => x.UserId == user && x.OfferedApartmentId == dto.OfferedApartmentId && x.Destination == dto.Destination.Trim() && x.Start == dto.Start && x.End == dto.End, ct);
        if (watch == null) {
            if (dto.Frequency == "Off") return NoContent();
            if (await context.ExchangeWatches.CountAsync(x => x.UserId == user, ct) >= 20) throw new ArgumentException("אפשר לשמור עד 20 התראות");
            watch = new serverApi.Models.ExchangeWatch { Id = Guid.NewGuid(), UserId = user, OfferedApartmentId = dto.OfferedApartmentId, Destination = dto.Destination.Trim(), Start = dto.Start, End = dto.End };
            context.ExchangeWatches.Add(watch);
        }
        watch.Guests = dto.Guests; watch.KosherKitchen = dto.KosherKitchen; watch.SeparateBeds = dto.SeparateBeds; watch.MaxSynagogueDistance = dto.MaxSynagogueDistance;
        watch.Revision++; watch.LeaseUntil = null; watch.Frequency = dto.Frequency; watch.LastSentAt = DateTime.UtcNow; watch.SeenIds = string.Join(',', homes.Select(x => x.ApartmentId));
        await context.SaveChangesAsync(ct); return Ok(new { watch.Id, watch.Frequency });
    });
    [HttpDelete("watches/{id:guid}")]
    public Task<IActionResult> DeleteWatch(Guid id, CancellationToken ct) => Execute(async () => {
        var watch = await context.ExchangeWatches.SingleOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUser, ct) ?? throw new KeyNotFoundException();
        context.ExchangeWatches.Remove(watch); await context.SaveChangesAsync(ct); return NoContent();
    });
    [HttpPatch("watches/{id:guid}/frequency")]
    public Task<IActionResult> WatchFrequency(Guid id, [FromBody] string frequency, CancellationToken ct) => Execute(async () => {
        if (frequency is not ("Off" or "Immediate" or "Daily" or "Weekly")) throw new ArgumentException("תדירות לא תקינה");
        var watch = await context.ExchangeWatches.SingleOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUser, ct) ?? throw new KeyNotFoundException();
        watch.Revision++; watch.LeaseUntil = null; watch.Frequency = frequency; await context.SaveChangesAsync(ct); return NoContent();
    });

}
