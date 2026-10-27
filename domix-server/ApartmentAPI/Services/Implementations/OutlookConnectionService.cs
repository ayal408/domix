using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace serverApi.Services.Implementations;

public record OutlookAuthorization(Guid AdminId, string Verifier, string RedirectUri);

/// <summary>Delegated Microsoft mail consent. No mailbox password is requested or stored.</summary>
public sealed class OutlookConnectionService(IMemoryCache cache, IHttpClientFactory clients, IConfiguration config)
{
    private readonly object stateLock = new();
    private const string Scopes = "offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Send";
    public bool Available => !string.IsNullOrWhiteSpace(config["Outlook:ClientId"]) && !string.IsNullOrWhiteSpace(config["Outlook:ClientSecret"]);
    public string ClientUrl => (Environment.GetEnvironmentVariable("CLIENT_APP_URL") ?? config["ClientAppUrl"] ?? "http://localhost").TrimEnd('/');
    public string RedirectUri => config["Outlook:RedirectUri"] ?? ClientUrl + "/api/email/outlook/callback";
    private string Authority
    {
        get
        {
            var tenant = config["Outlook:TenantId"] ?? "common";
            if (tenant is not ("common" or "organizations" or "consumers") && !Guid.TryParse(tenant, out _))
                throw new InvalidOperationException("Invalid Microsoft tenant configuration.");
            return "https://login.microsoftonline.com/" + tenant + "/oauth2/v2.0/";
        }
    }
    private static string Encode(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    public string Start(Guid adminId)
    {
        if (!Available) throw new EmailNotConfiguredException("EMAIL_NOT_CONFIGURED");
        var state = Encode(RandomNumberGenerator.GetBytes(32));
        var verifier = Encode(RandomNumberGenerator.GetBytes(32));
        var authority = Authority;
        cache.Set("outlook-consent:" + state, new OutlookAuthorization(adminId, verifier, RedirectUri), TimeSpan.FromMinutes(10));
        var query = new Dictionary<string,string> {
            ["client_id"] = config["Outlook:ClientId"]!, ["redirect_uri"] = RedirectUri,
            ["response_type"] = "code", ["response_mode"] = "query", ["scope"] = Scopes,
            ["prompt"] = "consent", ["state"] = state,
            ["code_challenge"] = Encode(SHA256.HashData(Encoding.ASCII.GetBytes(verifier))), ["code_challenge_method"] = "S256"
        };
        return authority + "authorize?" + string.Join("&", query.Select(p => Uri.EscapeDataString(p.Key) + "=" + Uri.EscapeDataString(p.Value)));
    }
    public OutlookAuthorization? Consume(string? state)
    {
        if (string.IsNullOrEmpty(state) || state.Length > 128) return null;
        lock (stateLock)
        {
            var key = "outlook-consent:" + state;
            if (!cache.TryGetValue<OutlookAuthorization>(key, out var result)) return null;
            cache.Remove(key);
            return result;
        }
    }
    private async Task<(string AccessToken, string? RefreshToken)> TokenAsync(Dictionary<string,string> values, CancellationToken ct)
    {
        if (!Available) throw new EmailNotConfiguredException("EMAIL_NOT_CONFIGURED");
        values["client_id"] = config["Outlook:ClientId"]!;
        values["client_secret"] = config["Outlook:ClientSecret"]!;
        values["scope"] = Scopes;
        using var client = clients.CreateClient("OutlookMail");
        using var form = new FormUrlEncodedContent(values);
        using var response = await client.PostAsync(Authority + "token", form, ct);
        var text = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            try {
                using var failure = JsonDocument.Parse(text);
                if (failure.RootElement.TryGetProperty("error", out var error) && error.GetString() is "invalid_grant" or "interaction_required" or "consent_required")
                    throw new GmailReconnectRequiredException();
            } catch (JsonException) { }
            throw new HttpRequestException("Microsoft token service rejected the request.", null, response.StatusCode);
        }
        using var json = JsonDocument.Parse(text);
        var token = json.RootElement.GetProperty("access_token").GetString();
        var scopes = json.RootElement.TryGetProperty("scope", out var scope) ? scope.GetString() ?? "" : "";
        if (string.IsNullOrWhiteSpace(token) || !scopes.Split(' ').Any(s => s.Equals("Mail.Send", StringComparison.OrdinalIgnoreCase) || s.Equals("https://graph.microsoft.com/Mail.Send", StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Microsoft did not grant mail sending permission.");
        return (token, json.RootElement.TryGetProperty("refresh_token", out var refresh) ? refresh.GetString() : null);
    }
    public async Task<(string Email, string RefreshToken)> CompleteAsync(OutlookAuthorization pending, string code, CancellationToken ct)
    {
        var token = await TokenAsync(new() { ["grant_type"] = "authorization_code", ["code"] = code,
            ["code_verifier"] = pending.Verifier, ["redirect_uri"] = pending.RedirectUri }, ct);
        if (string.IsNullOrWhiteSpace(token.RefreshToken)) throw new InvalidOperationException("Microsoft did not grant offline access.");
        using var client = clients.CreateClient("OutlookMail");
        using var request = new HttpRequestMessage(HttpMethod.Get, "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        using var response = await client.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        using var profile = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var email = profile.RootElement.TryGetProperty("mail", out var mail) ? mail.GetString() : null;
        if (string.IsNullOrWhiteSpace(email) && profile.RootElement.TryGetProperty("userPrincipalName", out var principal)) email = principal.GetString();
        if (!EmailService.IsMailbox(email)) throw new InvalidOperationException("Microsoft account has no valid mailbox address.");
        return (email!, token.RefreshToken);
    }
    public Task<(string AccessToken, string? RefreshToken)> RefreshAsync(string refreshToken, CancellationToken ct) =>
        TokenAsync(new() { ["grant_type"] = "refresh_token", ["refresh_token"] = refreshToken }, ct);

    public async Task SendAsync(string accessToken, string mime, CancellationToken ct)
    {
        using var client = clients.CreateClient("OutlookMail");
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://graph.microsoft.com/v1.0/me/sendMail");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Content = new StringContent(Convert.ToBase64String(Encoding.UTF8.GetBytes(mime)), Encoding.UTF8, "text/plain");
        using var response = await client.SendAsync(request, ct);
        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden) throw new GmailReconnectRequiredException();
        // Do not retry an ambiguous send: Graph may already have accepted the message.
        response.EnsureSuccessStatusCode();
    }
}
