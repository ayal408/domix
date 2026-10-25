using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;

namespace serverApi.Services.Implementations;

public class ExchangeConflict(string message) : Exception(message);
public class ExchangeForbidden : Exception { }

public class ExchangeWorkflow(ApartmentContext db)
{
    public static bool Overlaps(DateOnly start, DateOnly end, DateOnly otherStart, DateOnly otherEnd) => start < otherEnd && otherStart < end;
    public static void ValidateDates(DateOnly start, DateOnly end)
    {
        if (start < ExchangeMatching.Today || end <= start) throw new ArgumentException("יש לבחור תקופה עתידית עם תאריך יציאה מאוחר מהכניסה");
    }
    // Row locks in stable order serialize acceptance and manual blocking for either home.
    // A transaction is required in PostgreSQL; InMemory is only used by unit tests.
    internal async Task<IDbContextTransaction?> LockHomes(IEnumerable<Guid> ids, CancellationToken ct, Guid? ownerId = null)
    {
        if (!db.Database.IsRelational()) return null;
        var transaction = await db.Database.BeginTransactionAsync(ct);
        try
        {
            if (ownerId.HasValue) {
                await db.Database.ExecuteSqlInterpolatedAsync($"""SELECT 1 FROM "Users" WHERE "UserId" = {ownerId.Value} FOR UPDATE""", ct);
                var owned = await db.Apartments.Where(x => x.UserId == ownerId.Value).Select(x => x.ApartmentId).ToListAsync(ct);
                ids = ids.Concat(owned);
            }
            foreach (var id in ids.Distinct().OrderBy(x => x))
                await db.Database.ExecuteSqlInterpolatedAsync($"""SELECT 1 FROM "Apartments" WHERE "ApartmentId" = {id} FOR UPDATE""", ct);
            return transaction;
        }
        catch { await transaction.DisposeAsync(); throw; }
    }
    public static bool CoveredByPeriods(IEnumerable<ExchangeCalendarPeriod> periods, DateOnly start, DateOnly end)
    {
        var cursor = start;
        foreach (var period in periods.Where(x => x.IsAvailable).OrderBy(x => x.Start))
        {
            if (period.End <= cursor) continue;
            if (period.Start > cursor) return false;
            cursor = period.End;
            if (cursor >= end) return true;
        }
        return false;
    }
    public async Task<HashSet<Guid>> AvailableIds(IEnumerable<Apartment> source, DateOnly start, DateOnly end, CancellationToken ct)
    {
        var homes = source.ToList();
        var ids = homes.Select(x => x.ApartmentId).ToList();
        var periods = await db.ExchangeCalendarPeriods.AsNoTracking().Where(x => ids.Contains(x.ApartmentId)).ToListAsync(ct);
        var reserved = await db.ExchangeAgreements.AsNoTracking().Where(x => x.Status == "Accepted" &&
            (ids.Contains(x.OfferedApartmentId) || ids.Contains(x.RequestedApartmentId)) && x.Start < end && start < x.End)
            .Select(x => new { x.OfferedApartmentId, x.RequestedApartmentId }).ToListAsync(ct);
        var occupied = reserved.SelectMany(x => new[] { x.OfferedApartmentId, x.RequestedApartmentId }).ToHashSet();
        var grouped = periods.ToLookup(x => x.ApartmentId);
        return homes.Where(home => {
            if (home.ListingType != "Exchange" || home.Status != ApartmentStatus.Available || occupied.Contains(home.ApartmentId)) return false;
            var calendar = grouped[home.ApartmentId].ToList();
            var covered = calendar.Any(x => x.IsAvailable) ? CoveredByPeriods(calendar, start, end) : ExchangeMatching.Covers(home, start, end);
            return covered && !calendar.Any(x => !x.IsAvailable && Overlaps(start, end, x.Start, x.End));
        }).Select(x => x.ApartmentId).ToHashSet();
    }
    public async Task<bool> IsAvailable(Apartment home, DateOnly start, DateOnly end, CancellationToken ct) =>
        (await AvailableIds(new[] { home }, start, end, ct)).Contains(home.ApartmentId);
    public async Task<ExchangeAgreement> Create(Guid userId, CreateExchangeAgreementDto dto, CancellationToken ct)
    {
        ValidateDates(dto.Start, dto.End);
        if (dto.Guests < 1 || dto.Guests > 30 || dto.Note.Length > 2000) throw new ArgumentException("פרטי הבקשה אינם תקינים");
        var offer = await db.Apartments.AsNoTracking().FirstOrDefaultAsync(x => x.ApartmentId == dto.OfferedApartmentId && x.UserId == userId, ct);
        var target = await db.Apartments.AsNoTracking().FirstOrDefaultAsync(x => x.ApartmentId == dto.RequestedApartmentId, ct);
        if (offer == null || target == null) throw new KeyNotFoundException("הדירה אינה זמינה בחשבונך");
        if (await db.ExchangeUserBlocks.AnyAsync(x => (x.UserId == userId && x.BlockedUserId == target.UserId) || (x.UserId == target.UserId && x.BlockedUserId == userId), ct)) throw new ExchangeForbidden();
        if (target.UserId == userId) throw new ArgumentException("אי אפשר להחליף עם עצמך");
        if (!await IsAvailable(offer, dto.Start, dto.End, ct) || !await IsAvailable(target, dto.Start, dto.End, ct))
            throw new ExchangeConflict("אחת הדירות אינה זמינה לכל התקופה");
        if (target.GuestCapacity.HasValue && dto.Guests > target.GuestCapacity) throw new ArgumentException("מספר האורחים גדול מהקיבולת שפורסמה");
        if (await db.ExchangeAgreements.AnyAsync(x => x.RequesterId == userId && x.OfferedApartmentId == offer.ApartmentId && x.RequestedApartmentId == target.ApartmentId && x.Start == dto.Start && x.End == dto.End && x.Status == "Pending", ct))
            throw new ExchangeConflict("כבר קיימת בקשה ממתינה לתאריכים האלה");
        var request = new ExchangeAgreement {
            Id = Guid.NewGuid(), RequesterId = userId, RecipientId = target.UserId,
            OfferedApartmentId = offer.ApartmentId, RequestedApartmentId = target.ApartmentId,
            OfferedHome = $"{offer.city}, {offer.address}", RequestedHome = $"{target.city}, {target.address}",
            Start = dto.Start, End = dto.End, Guests = dto.Guests, Note = dto.Note.Trim()
        };
        db.ExchangeAgreements.Add(request); await db.SaveChangesAsync(ct); return request;
    }
    private async Task<ExchangeAgreement> Participant(Guid id, Guid userId, CancellationToken ct)
    {
        var request = await db.ExchangeAgreements.FirstOrDefaultAsync(x => x.Id == id && (x.RequesterId == userId || x.RecipientId == userId), ct);
        return request ?? throw new KeyNotFoundException("הבקשה אינה נמצאת בחשבונך");
    }
    public async Task<ExchangeAgreement> Decide(Guid id, Guid userId, ExchangeDecisionDto dto, CancellationToken ct)
    {
        var request = await Participant(id, userId, ct);
        await using var transaction = await LockHomes(new[] { request.OfferedApartmentId, request.RequestedApartmentId }, ct);
        if (db.Database.IsRelational()) await db.Entry(request).ReloadAsync(ct);
        if (request.Revision != dto.Revision) throw new ExchangeConflict("הבקשה השתנתה. יש לרענן ולבדוק את פרטיה");
        var action = dto.Action;
        if (action == "Accept" || action == "Decline")
        {
            if (userId != request.RecipientId) throw new ExchangeForbidden();
            if (request.Status != "Pending") throw new ExchangeConflict("הבקשה כבר טופלה");
            if (action == "Accept")
            {
                if (await db.ExchangeUserBlocks.AnyAsync(x => (x.UserId == userId && x.BlockedUserId == request.RequesterId) || (x.UserId == request.RequesterId && x.BlockedUserId == userId), ct)) throw new ExchangeForbidden();
                ValidateDates(request.Start, request.End);
                var offer = await db.Apartments.AsNoTracking().SingleOrDefaultAsync(x => x.ApartmentId == request.OfferedApartmentId, ct);
                var target = await db.Apartments.AsNoTracking().SingleOrDefaultAsync(x => x.ApartmentId == request.RequestedApartmentId, ct);
                if (offer == null || target == null || offer.UserId != request.RequesterId || target.UserId != request.RecipientId ||
                    !await IsAvailable(offer, request.Start, request.End, ct) || !await IsAvailable(target, request.Start, request.End, ct))
                    throw new ExchangeConflict("אחת הדירות כבר אינה זמינה לתקופה הזו");
                if (dto.RecipientGuests < 1 || dto.RecipientGuests > 30 || (offer.GuestCapacity.HasValue && dto.RecipientGuests > offer.GuestCapacity)) throw new ExchangeConflict("מספר האורחים שלך גדול מקיבולת הדירה המוצעת");
                request.RecipientGuests = dto.RecipientGuests;
                if (target.GuestCapacity.HasValue && request.Guests > target.GuestCapacity) throw new ExchangeConflict("קיבולת הדירה השתנתה. יש לתאם מחדש");
            }
            request.Status = action == "Accept" ? "Accepted" : "Declined";
        }
        else if (action == "Complete")
        {
            if (request.Status != "Accepted" || request.End > ExchangeMatching.Today) throw new ExchangeConflict("אפשר לאשר השלמה רק לאחר סיום תקופת ההחלפה");
            if (userId == request.RequesterId) request.RequesterCompletedAt ??= DateTime.UtcNow;
            else request.RecipientCompletedAt ??= DateTime.UtcNow;
            if (request.RequesterCompletedAt.HasValue && request.RecipientCompletedAt.HasValue) request.Status = "Completed";
        }
        else if (action == "Cancel")
        {
            if (request.Status is not ("Pending" or "Accepted") || request.End <= ExchangeMatching.Today)
                throw new ExchangeConflict("אי אפשר לבטל בקשה זו");
            request.Status = "Cancelled";
        }
        else throw new ArgumentException("פעולה לא מוכרת");
        request.Revision++; request.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        if (transaction != null) await transaction.CommitAsync(ct);
        return request;
    }
    public async Task<ExchangeAgreement> Counter(Guid id, Guid userId, ExchangeCounterDto dto, CancellationToken ct)
    {
        var original = await Participant(id, userId, ct);
        await using var transaction = await LockHomes(new[] { original.OfferedApartmentId, original.RequestedApartmentId }, ct);
        if (db.Database.IsRelational()) await db.Entry(original).ReloadAsync(ct);
        if (original.Status != "Pending" || original.Revision != dto.Revision) throw new ExchangeConflict("הבקשה השתנתה או כבר טופלה");
        var reverse = original.RecipientId == userId;
        var replacement = await Create(userId, new CreateExchangeAgreementDto {
            OfferedApartmentId = reverse ? original.RequestedApartmentId : original.OfferedApartmentId,
            RequestedApartmentId = reverse ? original.OfferedApartmentId : original.RequestedApartmentId,
            Start = dto.Start, End = dto.End, Guests = dto.Guests, Note = dto.Note
        }, ct);
        original.Status = "Countered"; original.Revision++; original.UpdatedAt = DateTime.UtcNow;
        replacement.ReplacesId = original.Id;
        await db.SaveChangesAsync(ct); if (transaction != null) await transaction.CommitAsync(ct);
        return replacement;
    }
    public async Task<ExchangeCalendarPeriod> AddPeriod(Guid id, Guid userId, CalendarPeriodDto dto, CancellationToken ct)
    {
        ValidateDates(dto.Start, dto.End);
        await using var transaction = await LockHomes(new[] { id }, ct);
        if (!await db.Apartments.AnyAsync(x => x.ApartmentId == id && x.UserId == userId && x.ListingType == "Exchange", ct)) throw new KeyNotFoundException("הדירה אינה נמצאת בחשבונך");
        if (!dto.IsAvailable && await db.ExchangeAgreements.AnyAsync(x => x.Status == "Accepted" &&
            (x.OfferedApartmentId == id || x.RequestedApartmentId == id) && x.Start < dto.End && dto.Start < x.End, ct))
            throw new ExchangeConflict("קיימת החלפה מאושרת בתקופה הזו. יש לבטל אותה לפני חסימת התאריכים");
        var period = new ExchangeCalendarPeriod { Id = Guid.NewGuid(), ApartmentId = id, Start = dto.Start, End = dto.End, IsAvailable = dto.IsAvailable };
        db.ExchangeCalendarPeriods.Add(period); await db.SaveChangesAsync(ct); if (transaction != null) await transaction.CommitAsync(ct); return period;
    }
    public async Task RemovePeriod(Guid periodId, Guid userId, CancellationToken ct)
    {
        var period = await db.ExchangeCalendarPeriods.FirstOrDefaultAsync(x => x.Id == periodId, ct) ?? throw new KeyNotFoundException();
        await using var transaction = await LockHomes(new[] { period.ApartmentId }, ct);
        if (!await db.Apartments.AnyAsync(x => x.ApartmentId == period.ApartmentId && x.UserId == userId, ct)) throw new ExchangeForbidden();
        db.ExchangeCalendarPeriods.Remove(period); await db.SaveChangesAsync(ct); if (transaction != null) await transaction.CommitAsync(ct);
    }
}
