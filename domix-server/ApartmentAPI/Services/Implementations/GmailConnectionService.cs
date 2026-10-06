using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using serverApi.Models;

namespace serverApi.Services.Implementations;

public record GmailAuthorization(Guid AdminId, string Verifier, string RedirectUri);

/// <summary>Consent for mail sending is separate from signing in to DOMIX.</summary>
public sealed class GmailConnectionService(
    IMemoryCache cache, IHttpClientFactory clients, IOptions<GmailSettings> settings, IConfiguration configuration)
{
    private readonly object _stateLock = new();
    private static string Encode(byte[] data) => Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    public string ClientUrl => (Environment.GetEnvironmentVariable("CLIENT_APP_URL")
        ?? configuration["ClientAppUrl"] ?? "http://localhost").TrimEnd('/');
    public string RedirectUri => configuration["Gmail:RedirectUri"] ?? ClientUrl + "/api/email/gmail/callback";

    public string Start(Guid adminId)
    {
        var state = Encode(RandomNumberGenerator.GetBytes(32));
        var verifier = Encode(RandomNumberGenerator.GetBytes(32));
        cache.Set("gmail-consent:" + state, new GmailAuthorization(adminId, verifier, RedirectUri), TimeSpan.FromMinutes(10));
        var parameters = new Dictionary<string, string>
        {
            ["client_id"] = settings.Value.ClientId,
            ["redirect_uri"] = RedirectUri,
            ["response_type"] = "code",
            ["scope"] = "openid email https://www.googleapis.com/auth/gmail.send",
            ["access_type"] = "offline",
            ["prompt"] = "consent select_account",
            ["state"] = state,
            ["code_challenge"] = Encode(SHA256.HashData(Encoding.ASCII.GetBytes(verifier))),
            ["code_challenge_method"] = "S256"
        };
        return "https://accounts.google.com/o/oauth2/v2/auth?" + string.Join("&", parameters.Select(p =>
            Uri.EscapeDataString(p.Key) + "=" + Uri.EscapeDataString(p.Value)));
    }

    public GmailAuthorization? Consume(string? state)
    {
        if (string.IsNullOrEmpty(state) || state.Length > 128) return null;
        lock (_stateLock)
        {
            var key = "gmail-consent:" + state;
            if (!cache.TryGetValue<GmailAuthorization>(key, out var result)) return null;
            cache.Remove(key);
            return result;
        }
    }

    public async Task<(string Email, string RefreshToken)> CompleteAsync(GmailAuthorization pending, string code, CancellationToken ct)
    {
        using var client = clients.CreateClient("GmailConsent");
        using var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = settings.Value.ClientId,
            ["client_secret"] = settings.Value.ClientSecret,
            ["code"] = code,
            ["code_verifier"] = pending.Verifier,
            ["redirect_uri"] = pending.RedirectUri,
            ["grant_type"] = "authorization_code"
        });
        using var response = await client.PostAsync("https://oauth2.googleapis.com/token", form, ct);
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var token = json.RootElement.GetProperty("access_token").GetString();
        var refreshToken = json.RootElement.TryGetProperty("refresh_token", out var refresh) ? refresh.GetString() : null;
        var scope = json.RootElement.TryGetProperty("scope", out var scopes) ? scopes.GetString() : "";
        if (string.IsNullOrWhiteSpace(refreshToken) || !(scope ?? "").Split(' ').Contains("https://www.googleapis.com/auth/gmail.send"))
            throw new InvalidOperationException("Google did not grant persistent mail sending access.");
        using var request = new HttpRequestMessage(HttpMethod.Get, "https://openidconnect.googleapis.com/v1/userinfo");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var identityResponse = await client.SendAsync(request, ct);
        identityResponse.EnsureSuccessStatusCode();
        using var identity = JsonDocument.Parse(await identityResponse.Content.ReadAsStringAsync(ct));
        if (!identity.RootElement.GetProperty("email_verified").GetBoolean())
            throw new InvalidOperationException("The Google account email is not verified.");
        var email = identity.RootElement.GetProperty("email").GetString();
        if (string.IsNullOrWhiteSpace(email)) throw new InvalidOperationException("Google account email is missing.");
        return (email, refreshToken);
    }
}
