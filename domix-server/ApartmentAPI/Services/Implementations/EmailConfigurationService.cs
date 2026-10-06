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
        if (!config.Enabled) throw new InvalidOperationException("EMAIL_DISCONNECTED");
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
            throw new InvalidOperationException("EMAIL_NOT_CONFIGURED");
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
        await SaveAsync(settings, ct);
    }

    public async Task DisconnectAsync(CancellationToken ct = default)
    {
        var settings = await GetAsync(ct);
        settings.Enabled = false;
        settings.ProtectedRefreshToken = null;
        await SaveAsync(settings, ct);
    }
}
