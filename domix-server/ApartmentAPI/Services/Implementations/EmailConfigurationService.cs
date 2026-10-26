using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using serverApi.Data;
using serverApi.Models;

namespace serverApi.Services.Implementations;

public sealed class EmailConfigurationService(
    ApartmentContext db, IOptions<GmailSettings> defaults, GmailTokenProtector protector)
{
    public async Task<SystemEmailSettings> GetAsync(CancellationToken ct = default) =>
        await db.SystemEmailSettings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == 1, ct)
        ?? new SystemEmailSettings { Email = defaults.Value.Email, UpdatedAt = DateTime.UnixEpoch };

    public async Task<GmailSettings> GetCredentialsAsync(CancellationToken ct = default)
    {
        var config = await GetAsync(ct);
        if (!config.Enabled) throw new EmailNotConfiguredException("EMAIL_DISCONNECTED");
        var settings = new GmailSettings
        {
            Email = config.Email,
            ClientId = defaults.Value.ClientId,
            ClientSecret = defaults.Value.ClientSecret,
            RefreshToken = config.ProtectedRefreshToken is null
                ? defaults.Value.RefreshToken : protector.Unprotect(config.ProtectedRefreshToken)
        };
        if (string.IsNullOrWhiteSpace(settings.Email) || string.IsNullOrWhiteSpace(settings.RefreshToken)
            || string.IsNullOrWhiteSpace(settings.ClientId) || string.IsNullOrWhiteSpace(settings.ClientSecret))
            throw new EmailNotConfiguredException("EMAIL_NOT_CONFIGURED");
        return settings;
    }

    public async Task<bool> IsConnectedAsync(CancellationToken ct = default)
    {
        try { await GetCredentialsAsync(ct); return true; }
        catch (InvalidOperationException) { return false; }
        catch (System.Security.Cryptography.CryptographicException) { return false; }
        catch (FormatException) { return false; }
    }

    public bool OAuthAvailable => !string.IsNullOrWhiteSpace(defaults.Value.ClientId)
        && !string.IsNullOrWhiteSpace(defaults.Value.ClientSecret);

    public async Task SaveAsync(SystemEmailSettings values, CancellationToken ct = default)
    {
        var existing = await db.SystemEmailSettings.SingleOrDefaultAsync(x => x.Id == 1, ct);
        if (existing is null) db.SystemEmailSettings.Add(values);
        else db.Entry(existing).CurrentValues.SetValues(values);
        values.UpdatedAt = DateTime.UtcNow;
        if (existing is not null) existing.UpdatedAt = values.UpdatedAt;
        await db.SaveChangesAsync(ct);
    }

    public async Task ConnectAsync(string email, string refreshToken, CancellationToken ct = default)
    {
        var settings = await GetAsync(ct);
        settings.Email = email;
        settings.ProtectedRefreshToken = protector.Protect(refreshToken);
        settings.Enabled = true;
        settings.ConnectionStatus = "configured";
        settings.LastCheckedAt = null;
        await SaveAsync(settings, ct);
    }

    // A late send result must not overwrite the state of a newly connected account.
    public async Task RecordHealthAsync(DateTime version, string status, CancellationToken ct)
    {
        var value = await db.SystemEmailSettings.SingleOrDefaultAsync(x => x.Id == 1, ct);
        if (value is null)
        {
            value = await GetAsync(ct);
            if (value.UpdatedAt != version) return;
            value.ConnectionStatus = status;
            value.LastCheckedAt = DateTime.UtcNow;
            await SaveAsync(value, ct);
            return;
        }
        var updated = await db.SystemEmailSettings.Where(x => x.Id == 1 && x.UpdatedAt == version)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ConnectionStatus, status)
                .SetProperty(x => x.LastCheckedAt, DateTime.UtcNow), ct);
        if (updated == 1 && status == "verified")
            await db.SavedSearchEmails.Where(x => x.Status == "Blocked")
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "Pending").SetProperty(x => x.FailureCode, (string?)null), ct);
    }

    public async Task DisconnectAsync(CancellationToken ct = default)
    {
        var settings = await GetAsync(ct);
        settings.Enabled = false;
        settings.ConnectionStatus = "disconnected";
        settings.LastCheckedAt = null;
        settings.ProtectedRefreshToken = null;
        await SaveAsync(settings, ct);
    }
}

public sealed class EmailNotConfiguredException(string code) : InvalidOperationException(code);
