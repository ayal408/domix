using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Services.Implementations;

namespace serverApi.Controllers;

[ApiController, Route("api/privacy"), Authorize]
public class PrivacyController(ApartmentContext db, IConfiguration? config = null) : ControllerBase
{
    private Guid Caller => Guid.Parse(User.FindFirst("userId")?.Value ?? User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("listing-contact/{id:guid}")]
    public async Task<IActionResult> Contact(Guid id, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        var apartment = await db.Apartments.AsNoTracking().FirstOrDefaultAsync(a => a.ApartmentId == id, ct);
        if (apartment is null || apartment.IsAnonymous) return NotFound();
        var owner = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == apartment.UserId && !u.IsBlocked, ct);
        if (owner is null) return NotFound();
        string? avatar = null;
        if (owner.ProfileImage is not null)
        {
            try { using var input = new MemoryStream(owner.ProfileImage); avatar = Convert.ToBase64String(await PrivacyImages.SanitizeAsync(input, ct)); }
            catch (ArgumentException) { /* Invalid legacy media is not published. */ }
        }
        return Ok(new { owner.UserId, owner.UserName, owner.JoiningDate,
            ProfileImageBase64 = avatar,
            PhoneNumber = owner.SharePhone ? owner.PhoneNumber : null });
    }

    [AllowAnonymous, HttpGet("info")]
    public IActionResult Info() => Ok(new {
        OperatorName = config?["Privacy:OperatorName"],
        ContactEmail = config?["Privacy:ContactEmail"],
        ResolvedSupportRetentionDays = config?.GetValue<int>("Privacy:ResolvedSupportRetentionDays") ?? 0,
        DeliveryContentRetentionDays = config?.GetValue<int>("Privacy:DeliveryContentRetentionDays") ?? 0,
        ArchivedListingContentRetentionDays = config?.GetValue<int>("Privacy:ArchivedListingContentRetentionDays") ?? 0,
    });

    public record ContactPreferences(bool SharePhone);
    [HttpPatch("contact-preferences")]
    public async Task<IActionResult> Preferences(ContactPreferences preferences, CancellationToken ct)
    {
        var user = await db.Users.SingleAsync(u => u.UserId == Caller, ct);
        user.SharePhone = preferences.SharePhone;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    public record MessagePreferences(bool ReceiveMessageEmails);
    [HttpGet("message-preferences")]
    public async Task<IActionResult> GetMessagePreferences(CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(await db.Users.AsNoTracking().Where(u => u.UserId == Caller)
            .Select(u => new MessagePreferences(u.ReceiveMessageEmails)).SingleAsync(ct));
    }
    [HttpPatch("message-preferences")]
    public async Task<IActionResult> SaveMessagePreferences(MessagePreferences input, CancellationToken ct)
    {
        var user = await db.Users.SingleAsync(u => u.UserId == Caller, ct);
        user.ReceiveMessageEmails = input.ReceiveMessageEmails;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // Self-only export: authentication credentials/tokens and unrelated users' profiles are never exported.
    [HttpGet("export")]
    public async Task<IActionResult> Export(CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        var id = Caller;
        var profile = await db.Users.AsNoTracking().Where(u => u.UserId == id).Select(u => new {
            u.UserId, u.UserName, u.EmailAddress, u.PhoneNumber, u.SharePhone, u.ReceiveMessageEmails, u.JoiningDate, u.LanguagePreference }).SingleAsync(ct);
        var listings = await db.Apartments.IgnoreQueryFilters().AsNoTracking().Where(a => a.UserId == id)
            .Select(a => new { a.ApartmentId, a.city, a.area, a.address, a.description, a.price, a.ListingType,
                a.AvailableFrom, a.AvailableTo, a.DesiredCity, a.IsAnonymous, a.IsDeleted, a.dateInsert }).ToListAsync(ct);
        var correspondence = await db.Messages.AsNoTracking().Where(m => (m.SenderId == id || m.OwnerId == id) && !m.IsDeleted)
            .Select(m => new { m.MessageId, SentByMe = m.SenderId == id, m.Content, m.CreatedAt, m.ApartmentId,
                m.ExchangeStart, m.ExchangeEnd }).ToListAsync(ct);
        var support = await db.SupportTickets.AsNoTracking().Where(t => t.UserId == id)
            .Select(t => new { t.SupportTicketId, t.ContactName, t.ContactEmail, t.Message, t.Transcript, t.Status, t.CreatedAt }).ToListAsync(ct);
        var searches = await db.SavedSearches.AsNoTracking().Where(s => s.UserId == id).Select(s => new {
            s.SavedSearchId, s.Name, s.City, s.Area, s.ListingType, s.MinPrice, s.MaxPrice, s.MinRooms, s.MaxRooms,
            s.PropertyType, s.Parking, s.Elevator, s.CreatedAt, s.LastNotifiedAt }).ToListAsync(ct);
        var oldSearches = await db.SearchRequests.AsNoTracking().Where(s => s.UserId == id).Select(s => new {
            s.SearchId, s.Location, s.MinPrice, s.MaxPrice, s.MinBedrooms, s.MaxBedrooms, s.CreatedAt }).ToListAsync(ct);
        var appointments = await db.Appointments.AsNoTracking().Where(a => a.UserId == id).Select(a => new {
            a.AppointmentId, a.ApartmentId, a.AppointmentDate, a.Status }).ToListAsync(ct);
        var ratings = await db.ApartmentRatings.AsNoTracking().Where(a => a.UserId == id).Select(a => new {
            a.ApartmentId, a.Score, a.CreatedAt, a.UpdatedAt }).ToListAsync(ct);
        var deals = await db.ClosingDeals.AsNoTracking().Where(d => d.idUserBuyer == id || d.idUserManager == id).Select(d => new {
            d.ClosingDealId, d.ApartmentId, IsBuyer = d.idUserBuyer == id, d.dealCloseingDate, d.startDate, d.endDate }).ToListAsync(ct);
        var favorites = await db.Favorites.AsNoTracking().Where(f => f.UserId == id).Select(f => f.ApartmentId).ToListAsync(ct);
        var visits = await db.ConversationVisits.AsNoTracking().Where(v=>v.ParticipantA==id || v.ParticipantB==id)
            .Select(v=>new {v.Id,v.ConversationId,v.StartsAt,v.Status,v.UpdatedAt,ProposedByMe=v.ProposedBy==id}).ToListAsync(ct);
        var reports = await db.ListingReports.AsNoTracking().Where(r=>r.ReporterId==id)
            .Select(r=>new {r.Id,r.MessageId,r.ApartmentId,r.Reason,r.Details,r.Evidence,r.CreatedAt,r.ReviewedAt}).ToListAsync(ct);
        var blockedCount = await db.UserBlocks.CountAsync(b=>b.BlockerId==id,ct);
        return Ok(new { Visits=visits, Reports=reports, BlockedCount=blockedCount, GeneratedAt = DateTime.UtcNow, Profile = profile, Listings = listings,
            Correspondence = correspondence, Support = support, SavedSearches = searches, Favorites = favorites, SearchRequests = oldSearches, Appointments = appointments, Ratings = ratings, Deals = deals });
    }
}
