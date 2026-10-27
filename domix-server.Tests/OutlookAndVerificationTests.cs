using System.Net;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Data;
using serverApi.Models;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;

namespace domix_server.Tests;

public class OutlookAndVerificationTests
{
    private sealed class Handler(Func<HttpRequestMessage, Task<HttpResponseMessage>> respond) : HttpMessageHandler
    { protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => respond(request); }
    private sealed class Clients(HttpMessageHandler handler) : IHttpClientFactory
    { public HttpClient CreateClient(string name) => new(handler, false); }
    private static IConfiguration Config() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
        ["Outlook:ClientId"] = "client", ["Outlook:ClientSecret"] = "secret", ["Outlook:RedirectUri"] = "https://localhost/api/email/outlook/callback"
    }).Build();
    private static HttpResponseMessage Json(string json, HttpStatusCode status = HttpStatusCode.OK) => new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    [Fact]
    public void MicrosoftConsentIsPkceBoundSingleUseAndSeparateFromGmail()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new OutlookConnectionService(cache, null!, Config());
        var admin = Guid.NewGuid(); var uri = new Uri(service.Start(admin));
        var values = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(uri.Query);
        Assert.Equal("login.microsoftonline.com", uri.Host);
        Assert.Equal("S256", values["code_challenge_method"]);
        Assert.Contains("Mail.Send", values["scope"].ToString());
        Assert.Contains("offline_access", values["scope"].ToString());
        Assert.DoesNotContain("Mail.Read", values["scope"].ToString());
        Assert.Null(service.Consume("invalid"));
        var pending = service.Consume(values["state"]);
        Assert.NotNull(pending); Assert.Equal(admin, pending.AdminId);
        Assert.Null(service.Consume(values["state"]));
    }
    [Fact]
    public async Task MicrosoftConsentRequiresMailSendPermission()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        using var handler = new Handler(_ => Task.FromResult(Json("{\"access_token\":\"access\",\"refresh_token\":\"refresh\",\"scope\":\"User.Read\"}")));
        var service = new OutlookConnectionService(cache, new Clients(handler), Config());
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CompleteAsync(new(Guid.NewGuid(), "verifier", service.RedirectUri), "code", default));
    }
    [Fact]
    public async Task MicrosoftRevokedGrantRequestsReconnect()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        using var handler = new Handler(_ => Task.FromResult(Json("{\"error\":\"invalid_grant\"}", HttpStatusCode.BadRequest)));
        var service = new OutlookConnectionService(cache, new Clients(handler), Config());
        await Assert.ThrowsAsync<GmailReconnectRequiredException>(() => service.RefreshAsync("old", default));
    }
    [Fact]
    public async Task MicrosoftConsentExchangesCodeAndReadsMailbox()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        using var handler = new Handler(async request => {
            if (request.RequestUri!.Host == "login.microsoftonline.com") {
                var body = await request.Content!.ReadAsStringAsync();
                Assert.Contains("code_verifier=verifier", body);
                return Json("{\"access_token\":\"access\",\"refresh_token\":\"refresh\",\"scope\":\"User.Read Mail.Send\"}");
            }
            Assert.Equal("Bearer access", request.Headers.Authorization!.ToString());
            return Json("{\"mail\":\"sender@outlook.com\"}");
        });
        var service = new OutlookConnectionService(cache, new Clients(handler), Config());
        var result = await service.CompleteAsync(new(Guid.NewGuid(), "verifier", service.RedirectUri), "code", default);
        Assert.Equal("sender@outlook.com", result.Email); Assert.Equal("refresh", result.RefreshToken);
    }
    [Fact]
    public async Task MicrosoftSendsMimeOnceWithoutRetryingFailure()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions()); var calls = 0;
        using var handler = new Handler(async request => {
            calls++; Assert.Equal("https://graph.microsoft.com/v1.0/me/sendMail", request.RequestUri!.AbsoluteUri);
            Assert.Equal("text/plain", request.Content!.Headers.ContentType!.MediaType);
            Assert.Equal("mime body", Encoding.UTF8.GetString(Convert.FromBase64String(await request.Content.ReadAsStringAsync())));
            return new HttpResponseMessage(HttpStatusCode.ServiceUnavailable);
        });
        var service = new OutlookConnectionService(cache, new Clients(handler), Config());
        await Assert.ThrowsAsync<HttpRequestException>(() => service.SendAsync("access", "mime body", default));
        Assert.Equal(1, calls);
    }
    private sealed class FailedMail : IEmailService
    {
        public Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken ct = default) => throw new GmailReconnectRequiredException();
        public Task SendTestEmailAsync(string? recipientEmail = null, CancellationToken ct = default) => throw new GmailReconnectRequiredException();
    }
    [Fact]
    public async Task VerificationResendReportsDeliveryFailureAndKeepsAccount()
    {
        await using var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var user = new User { UserId = Guid.NewGuid(), UserName = "test", EmailAddress = "test@example.com" };
        db.Users.Add(user); await db.SaveChangesAsync();
        var service = new UserService(db, new FailedMail(), new ConfigurationBuilder().Build(), NullLogger<UserService>.Instance);
        var error = await Assert.ThrowsAsync<VerificationEmailDeliveryException>(() => service.ResendVerificationEmailAsync(user.UserId));
        Assert.Equal("EMAIL_RECONNECT_REQUIRED", error.Message);
        Assert.NotNull(await db.Users.FindAsync(user.UserId)); Assert.False(user.IsEmailVerified);
    }
}
