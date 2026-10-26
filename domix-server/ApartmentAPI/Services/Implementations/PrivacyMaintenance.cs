using Microsoft.EntityFrameworkCore;
using serverApi.Data;
namespace serverApi.Services.Implementations;

public class PrivacyMaintenance(ApartmentContext db, IConfiguration config, ILogger<PrivacyMaintenance> logger)
{
    public async Task SweepAsync(CancellationToken ct)
    {
        var images = await db.ApartmentImages.AsNoTracking().Where(i => db.Apartments.IgnoreQueryFilters().Any(a =>
            a.ApartmentId == i.ApartmentId && a.IsDeleted)).Select(i => i.ImageUrl).ToListAsync(ct);
        foreach (var url in images.Distinct())
        {
            ct.ThrowIfCancellationRequested();
            var path = PrivacyImages.LocalPath(url);
            if (path is null) continue;
            // An older duplicate reference must not remove a file belonging to an active listing.
            if (await db.ApartmentImages.AnyAsync(i => i.ImageUrl == url && db.Apartments.Any(a => a.ApartmentId == i.ApartmentId), ct)) continue;
            try { File.Delete(path); }
            catch (IOException) { logger.LogWarning("Archived media cleanup deferred."); }
            catch (UnauthorizedAccessException) { logger.LogWarning("Archived media cleanup permission failure."); }
        }
        // Zero/missing configuration disables timed purging. Operators must approve periods first.
        var archivedDays = config.GetValue<int>("Privacy:ArchivedListingContentRetentionDays");
        if (archivedDays > 0)
        {
            var before = DateTime.UtcNow.AddDays(-archivedDays);
            var listings = await db.Apartments.IgnoreQueryFilters().Where(a => a.IsDeleted && a.DeletedAt < before &&
                (a.address != "" || a.description != "" || a.Latitude != null || a.Longitude != null)).Take(200).ToListAsync(ct);
            foreach (var listing in listings)
            {
                listing.address = ""; listing.description = ""; listing.Latitude = null; listing.Longitude = null;
                listing.DesiredCity = null; listing.AvailableFrom = null; listing.AvailableTo = null;
            }
        }
        var supportDays = config.GetValue<int>("Privacy:ResolvedSupportRetentionDays");
        if (supportDays > 0)
        {
            var before = DateTime.UtcNow.AddDays(-supportDays);
            var tickets = await db.SupportTickets.Where(t => t.ResolvedAt < before && t.Status == serverApi.Models.SupportTicketStatus.Resolved).Take(200).ToListAsync(ct);
            db.SupportTickets.RemoveRange(tickets);
        }
        var deliveryDays = config.GetValue<int>("Privacy:DeliveryContentRetentionDays");
        if (deliveryDays > 0)
        {
            var before = DateTime.UtcNow.AddDays(-deliveryDays);
            var deliveries = await db.SavedSearchEmails.Where(x => x.CreatedAt < before &&
                (x.Status == "Sent" || x.Status == "Cancelled") && (x.Recipient != "" || x.HtmlBody != "")).Take(200).ToListAsync(ct);
            foreach (var item in deliveries) { item.Recipient = ""; item.Subject = ""; item.HtmlBody = ""; }
        }
        await db.SaveChangesAsync(ct);
    }
}

public class PrivacyMaintenanceBackgroundService(IServiceScopeFactory scopes, ILogger<PrivacyMaintenanceBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<PrivacyMaintenance>().SweepAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex) { logger.LogWarning("Privacy maintenance deferred ({FailureType}).", ex.GetType().Name); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
