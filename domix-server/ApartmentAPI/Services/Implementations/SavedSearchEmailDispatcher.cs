using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations;

public sealed class SavedSearchEmailDispatcher(ApartmentContext db, IEmailService email,
    ILogger<SavedSearchEmailDispatcher> logger)
{
    public async Task DispatchAsync(CancellationToken ct)
    {
        var abandoned = DateTime.UtcNow.AddMinutes(-5);
        // A crash or timeout after Gmail accepted a request has an ambiguous outcome.
        // Keep it visible for an administrator; do not silently replay it.
        await db.SavedSearchEmails.Where(x => x.Status == "Sending" && x.AttemptedAt < abandoned)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "Unknown")
                .SetProperty(x => x.FailureCode, "EMAIL_OUTCOME_UNKNOWN"), ct);
        var ids = await db.SavedSearchEmails.AsNoTracking().Where(x => x.Status == "Pending")
            .OrderBy(x => x.CreatedAt).Take(50).Select(x => x.Id).ToListAsync(ct);
        foreach (var id in ids)
        {
            ct.ThrowIfCancellationRequested();
            var claimed = await db.SavedSearchEmails.Where(x => x.Id == id && x.Status == "Pending")
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "Sending")
                    .SetProperty(x => x.AttemptedAt, DateTime.UtcNow), ct);
            if (claimed != 1) continue;
            var item = await db.SavedSearchEmails.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (item is null) continue;
            var active = await db.Users.AnyAsync(u => !u.IsBlocked && db.SavedSearches.Any(s => s.SavedSearchId == item.SavedSearchId && s.UserId == u.UserId && (s.AlertChannel=="Email" || s.AlertChannel=="Both")), ct);
            if (!active)
            {
                item.Status = "Cancelled"; item.Recipient = ""; item.Subject = ""; item.HtmlBody = "";
                await db.SaveChangesAsync(ct); continue;
            }
            try
            {
                await email.SendEmailAsync(item.Recipient, item.Subject, item.HtmlBody, ct);
                item.Status = "Sent";
                item.CompletedAt = DateTime.UtcNow;
                item.FailureCode = null;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                // No provider send was attempted for these configuration/token failures.
                item.Status = ex is GmailReconnectRequiredException or EmailNotConfiguredException ? "Blocked" : "Unknown";
                item.FailureCode = ex is GmailReconnectRequiredException ? "EMAIL_RECONNECT_REQUIRED"
                    : item.Status == "Blocked" ? "EMAIL_NOT_CONFIGURED" : "EMAIL_OUTCOME_UNKNOWN";
                logger.LogWarning("Saved search delivery {DeliveryId} stopped ({FailureType}).", id, ex.GetType().Name);
            }
            await db.SaveChangesAsync(ct);
        }
    }
}
