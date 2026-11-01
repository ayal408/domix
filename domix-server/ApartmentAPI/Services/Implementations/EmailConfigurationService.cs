using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using serverApi.Data;
using serverApi.Models;

namespace serverApi.Services.Implementations;

public sealed class EmailConfigurationService(
    ApartmentContext db, IOptions<GmailSettings> defaults, GmailTokenProtector protector, IConfiguration? serverConfiguration = null)
{
    public async Task<SystemEmailSettings> GetAsync(CancellationToken ct = default) =>
        await db.SystemEmailSettings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == 1, ct)
        ?? new SystemEmailSettings { Email = defaults.Value.Email, UpdatedAt = DateTime.UnixEpoch };

    public async Task<GmailSettings> GetCredentialsAsync(CancellationToken ct = default)
    {
        var config = await GetAsync(ct);
        if (config.Provider != "gmail") throw new EmailNotConfiguredException("EMAIL_NOT_CONFIGURED");
        if (!config.Enabled) throw new EmailNotConfiguredException("EMAIL_DISCONNECTED");
        var oauth = GetOAuthCredentials(config);
        var settings = new GmailSettings
        {
            Email = config.Email,
            ClientId = oauth.ClientId,
            ClientSecret = oauth.ClientSecret,
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
        try {
            var value = await GetAsync(ct);
            if (value.Provider == "outlook") return value.Enabled && OutlookAvailable && !string.IsNullOrWhiteSpace(value.ProtectedRefreshToken);
            await GetCredentialsAsync(ct); return true;
        }
        catch (InvalidOperationException) { return false; }
        catch (System.Security.Cryptography.CryptographicException) { return false; }
        catch (FormatException) { return false; }
    }

    public bool OutlookAvailable => !string.IsNullOrWhiteSpace(serverConfiguration?["Outlook:ClientId"])
        && !string.IsNullOrWhiteSpace(serverConfiguration?["Outlook:ClientSecret"]);

    public async Task<string> GetOutlookRefreshTokenAsync(CancellationToken ct)
    {
        var value = await GetAsync(ct);
        if (value.Provider != "outlook" || !value.Enabled || !OutlookAvailable || string.IsNullOrWhiteSpace(value.ProtectedRefreshToken))
            throw new EmailNotConfiguredException("EMAIL_NOT_CONFIGURED");
        return protector.Unprotect(value.ProtectedRefreshToken);
    }

    // Rotating an old token must not overwrite a newly connected/disconnected account.
    public async Task RotateOutlookTokenAsync(string? expected, string token, CancellationToken ct)
    {
        var encrypted = protector.Protect(token);
        await db.SystemEmailSettings.Where(x => x.Id == 1 && x.Provider == "outlook" && x.Enabled && x.ProtectedRefreshToken == expected)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ProtectedRefreshToken, encrypted), ct);
    }

    public async Task<(string ClientId, bool SecretConfigured)> GetOAuthSummaryAsync(CancellationToken ct = default)
    {
        var config = await GetAsync(ct);
        return (
            string.IsNullOrWhiteSpace(config.GoogleClientId) ? defaults.Value.ClientId : config.GoogleClientId,
            !string.IsNullOrWhiteSpace(config.ProtectedGoogleClientSecret) || !string.IsNullOrWhiteSpace(defaults.Value.ClientSecret)
        );
    }

    public async Task<GmailSettings> GetOAuthCredentialsAsync(CancellationToken ct = default) =>
        GetOAuthCredentials(await GetAsync(ct));

    private GmailSettings GetOAuthCredentials(SystemEmailSettings config)
    {
        var clientId = string.IsNullOrWhiteSpace(config.GoogleClientId) ? defaults.Value.ClientId : config.GoogleClientId;
        var clientSecret = config.ProtectedGoogleClientSecret is null
            ? defaults.Value.ClientSecret : protector.UnprotectClientSecret(config.ProtectedGoogleClientSecret);
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
            throw new EmailNotConfiguredException("EMAIL_NOT_CONFIGURED");
        return new GmailSettings { ClientId = clientId.Trim(), ClientSecret = clientSecret };
    }

    public async Task<bool> OAuthAvailableAsync(CancellationToken ct = default)
    {
        try { await GetOAuthCredentialsAsync(ct); return true; }
        catch (InvalidOperationException) { return false; }
        catch (System.Security.Cryptography.CryptographicException) { return false; }
        catch (FormatException) { return false; }
    }

    public async Task SaveOAuthCredentialsAsync(string clientId, string? clientSecret, CancellationToken ct = default)
    {
        clientId = clientId.Trim();
        clientSecret = clientSecret?.Trim();
        if (string.IsNullOrWhiteSpace(clientId) || clientId.Length > 500 || clientSecret?.Length > 500)
            throw new EmailNotConfiguredException("EMAIL_INVALID_OAUTH_SETTINGS");

        var value = await GetAsync(ct);
        var clientChanged = !string.Equals(value.GoogleClientId ?? defaults.Value.ClientId, clientId, StringComparison.Ordinal);
        var secretChanged = !string.IsNullOrWhiteSpace(clientSecret);
        if (!secretChanged && string.IsNullOrWhiteSpace(value.ProtectedGoogleClientSecret)
            && string.IsNullOrWhiteSpace(defaults.Value.ClientSecret))
            throw new EmailNotConfiguredException("EMAIL_INVALID_OAUTH_SETTINGS");

        value.GoogleClientId = clientId;
        if (secretChanged) value.ProtectedGoogleClientSecret = protector.ProtectClientSecret(clientSecret!);
        if (clientChanged || secretChanged)
        {
            value.ProtectedRefreshToken = null;
            value.Enabled = false;
            value.ConnectionStatus = "disconnected";
            value.LastCheckedAt = null;
        }
        await SaveAsync(value, ct);
    }

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
        await ConnectAccountAsync("gmail", email, refreshToken, ct);
    }

    public Task ConnectOutlookAsync(string email, string refreshToken, CancellationToken ct = default) =>
        ConnectAccountAsync("outlook", email, refreshToken, ct);

    private async Task ConnectAccountAsync(string provider, string email, string refreshToken, CancellationToken ct)
    {
        var settings = await GetAsync(ct);
        settings.Provider = provider;
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
