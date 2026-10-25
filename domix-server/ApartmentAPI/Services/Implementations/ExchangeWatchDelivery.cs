using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations;

public static class ExchangeSearch
{
    public static async Task<(Apartment Offer, List<Apartment> Homes)> Find(ApartmentContext db, Guid userId, ExchangeWatchDto dto, CancellationToken ct)
    {
        ExchangeWorkflow.ValidateDates(dto.Start, dto.End);
        if (string.IsNullOrWhiteSpace(dto.Destination) || dto.Destination.Length > 100 || dto.Guests is < 0 or > 30 || dto.MaxSynagogueDistance is < 0 or > 10000)
            throw new ArgumentException("פרטי החיפוש אינם תקינים");
        var offer = await db.Apartments.AsNoTracking().SingleOrDefaultAsync(x => x.ApartmentId == dto.OfferedApartmentId && x.UserId == userId, ct) ?? throw new KeyNotFoundException();
        var workflow = new ExchangeWorkflow(db);
        if (!await workflow.IsAvailable(offer, dto.Start, dto.End, ct)) throw new ExchangeConflict("הדירה שלך אינה זמינה לכל התקופה שנבחרה");
        var blocked = await db.ExchangeUserBlocks.Where(x => x.UserId == userId || x.BlockedUserId == userId)
            .Select(x => x.UserId == userId ? x.BlockedUserId : x.UserId).ToListAsync(ct);
        var city = dto.Destination.Trim().ToLower();
        var candidates = await db.Apartments.AsNoTracking().Include(x => x.ApartmentImages).Where(x => x.UserId != userId && !blocked.Contains(x.UserId) &&
            !db.Users.Any(u => u.UserId == x.UserId && u.IsBlocked) && x.ListingType == "Exchange" && x.Status == ApartmentStatus.Available && x.city.Trim().ToLower() == city &&
            (dto.Guests == 0 || x.GuestCapacity >= dto.Guests) && (!dto.KosherKitchen || x.KosherKitchen == true) &&
            (!dto.SeparateBeds || x.SeparateBeds == true) && (!dto.MaxSynagogueDistance.HasValue || x.SynagogueDistanceMeters <= dto.MaxSynagogueDistance)).ToListAsync(ct);
        var available = await workflow.AvailableIds(candidates, dto.Start, dto.End, ct);
        return (offer, candidates.Where(x => available.Contains(x.ApartmentId)).ToList());
    }
}

public class ExchangeWatchDelivery(ApartmentContext db, IEmailService email, IConfiguration configuration, ILogger<ExchangeWatchDelivery> logger)
{
    public static bool Due(ExchangeWatch watch, DateTime now) => watch.Frequency switch {
        "Immediate" => true,
        "Daily" => now - watch.LastSentAt >= TimeSpan.FromDays(1),
        "Weekly" => now - watch.LastSentAt >= TimeSpan.FromDays(7),
        _ => false
    };
    public async Task RunOnce(CancellationToken ct)
    {
        var watches = await db.ExchangeWatches.Where(x => x.Frequency != "Off" && x.Start >= ExchangeMatching.Today).ToListAsync(ct);
        foreach (var watch in watches)
        {
            ct.ThrowIfCancellationRequested();
            var leased = false;
            try
            {
                if (!Due(watch, DateTime.UtcNow) || watch.LeaseUntil > DateTime.UtcNow) continue;
                watch.LeaseUntil = DateTime.UtcNow.AddMinutes(10); watch.Revision++;
                try { await db.SaveChangesAsync(ct); leased = true; }
                catch (DbUpdateConcurrencyException) { db.Entry(watch).State = EntityState.Detached; continue; }
                var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == watch.UserId && !x.IsBlocked && x.IsEmailVerified, ct);
                if (string.IsNullOrWhiteSpace(user?.EmailAddress)) continue;
                var (_, homes) = await ExchangeSearch.Find(db, watch.UserId, new ExchangeWatchDto {
                    OfferedApartmentId = watch.OfferedApartmentId, Destination = watch.Destination, Start = watch.Start, End = watch.End,
                    Guests = watch.Guests, KosherKitchen = watch.KosherKitchen, SeparateBeds = watch.SeparateBeds, MaxSynagogueDistance = watch.MaxSynagogueDistance
                }, ct);
                var seen = watch.SeenIds.Split(',', StringSplitOptions.RemoveEmptyEntries).ToHashSet();
                var fresh = homes.Where(x => !seen.Contains(x.ApartmentId.ToString())).ToList();
                if (fresh.Count == 0) continue;
                var title = EmailText.Pick(user.LanguagePreference, $"נמצאו {fresh.Count} הצעות חדשות להחלפת דירות", $"{fresh.Count} new home exchange suggestions", $"{fresh.Count} nuevas sugerencias de intercambio", $"{fresh.Count} nouvelles propositions d’échange");
                var parameters = new Dictionary<string, string> {
                    ["offeredApartmentId"] = watch.OfferedApartmentId.ToString(), ["destination"] = watch.Destination,
                    ["start"] = watch.Start.ToString("yyyy-MM-dd"), ["end"] = watch.End.ToString("yyyy-MM-dd"),
                    ["guests"] = watch.Guests.ToString(), ["kosherKitchen"] = watch.KosherKitchen.ToString().ToLower(),
                    ["separateBeds"] = watch.SeparateBeds.ToString().ToLower()
                };
                if (watch.MaxSynagogueDistance.HasValue) parameters["maxSynagogueDistance"] = watch.MaxSynagogueDistance.Value.ToString();
                var appUrl = (configuration["CLIENT_APP_URL"] ?? "http://localhost").TrimEnd('/');
                var url = appUrl + "/exchange?" + string.Join("&", parameters.Select(x => Uri.EscapeDataString(x.Key) + "=" + Uri.EscapeDataString(x.Value)));
                var manage = appUrl + "/exchange/watches";
                var body = EmailText.Paragraph(watch.Destination) + EmailText.Paragraph(EmailText.Pick(user.LanguagePreference,
                    "ההצעות דורשות תיאום ואישור. ניתן לשנות תדירות או לבטל התראות בניהול ההתראות.",
                    "Suggestions need agreement. Change frequency or stop alerts in alert settings.", "Puedes cambiar o desactivar las alertas.", "Vous pouvez modifier ou désactiver les alertes.")) +
                    $"<p><a href=\"{EmailText.Safe(manage)}\">{EmailText.Safe(EmailText.Pick(user.LanguagePreference, "ניהול וביטול התראות", "Manage or stop alerts", "Gestionar alertas", "Gérer les alertes"))}</a></p>";
                if (!await db.ExchangeWatches.AsNoTracking().AnyAsync(x => x.Id == watch.Id && x.Revision == watch.Revision && x.Frequency != "Off", ct)) continue;
                await email.SendEmailAsync(user.EmailAddress, title, EmailTemplates.Render(title, body,
                    EmailText.Pick(user.LanguagePreference, "צפייה בהצעות", "View suggestions", "Ver sugerencias", "Voir les propositions"), url, user.LanguagePreference), ct);
                foreach (var home in fresh) seen.Add(home.ApartmentId.ToString());
                watch.SeenIds = string.Join(',', seen); watch.LastSentAt = DateTime.UtcNow; watch.Revision++;
                await db.SaveChangesAsync(ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception ex) { logger.LogWarning(ex, "Exchange watch {WatchId} could not be delivered", watch.Id); }
            finally {
                if (leased) {
                    watch.LeaseUntil = null; watch.Revision++;
                    try { await db.SaveChangesAsync(ct); }
                    catch (DbUpdateConcurrencyException) { db.Entry(watch).State = EntityState.Detached; }
                }
            }
        }
    }
}

public class ExchangeWatchBackgroundService(IServiceScopeFactory scopes, IConfiguration configuration, ILogger<ExchangeWatchBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(Math.Max(1, configuration.GetValue<int?>("ExchangeAlerts:IntervalMinutes") ?? 15)));
        while (!stoppingToken.IsCancellationRequested)
        {
            try {
                using var scope = scopes.CreateScope();
                await new ExchangeWatchDelivery(scope.ServiceProvider.GetRequiredService<ApartmentContext>(), scope.ServiceProvider.GetRequiredService<IEmailService>(),
                    configuration, scope.ServiceProvider.GetRequiredService<ILogger<ExchangeWatchDelivery>>()).RunOnce(stoppingToken);
                await timer.WaitForNextTickAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Exchange alert sweep failed"); await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
        }
    }
}
