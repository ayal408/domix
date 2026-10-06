using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using serverApi.Data;
using serverApi.Models;
using serverApi.Services.Implementations;

namespace domix_server.Tests;

public class EmailConfigurationTests
{
    private const string Secret = "a-test-server-secret-with-at-least-32-characters";
    private static EmailConfigurationService MakeService(ApartmentContext db) => new(db,
        Options.Create(new GmailSettings { Email = "sender@example.com", ClientId = "client", ClientSecret = "secret", RefreshToken = "configured-token" }),
        new GmailTokenProtector(Secret));
    private static ApartmentContext MakeContext() => new(new DbContextOptionsBuilder<ApartmentContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Fact]
    public void ProtectedTokensAreRandomizedAndRejectWrongKeys()
    {
        var protector = new GmailTokenProtector(Secret);
        var one = protector.Protect("refresh-token");
        var two = protector.Protect("refresh-token");
        Assert.NotEqual(one, two);
        Assert.Equal("refresh-token", protector.Unprotect(one));
        Assert.ThrowsAny<CryptographicException>(() => new GmailTokenProtector(Secret + "different").Unprotect(one));
    }

    [Fact]
    public async Task DisconnectDisablesEvenAnExistingEnvironmentAccount()
    {
        await using var db = MakeContext();
        var service = MakeService(db);
        Assert.True(await service.IsConnectedAsync());
        await service.DisconnectAsync();
        Assert.False(await service.IsConnectedAsync());
        Assert.False((await service.GetAsync()).Enabled);
    }

    [Fact]
    public async Task ReconnectUsesNewAccountAndStoresOnlyProtectedToken()
    {
        await using var db = MakeContext();
        var service = MakeService(db);
        await service.DisconnectAsync();
        await service.ConnectAsync("new@example.com", "new-token");
        var credentials = await service.GetCredentialsAsync();
        Assert.Equal("new@example.com", credentials.Email);
        Assert.Equal("new-token", credentials.RefreshToken);
        Assert.NotEqual("new-token", (await service.GetAsync()).ProtectedRefreshToken);
    }

    [Fact]
    public void ConsentStateIsSingleUseAndBoundToInitiatingAdministrator()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new GmailConnectionService(cache, null!,
            Options.Create(new GmailSettings { ClientId = "existing-client" }), new ConfigurationBuilder().Build());
        var adminId = Guid.NewGuid();
        var url = service.Start(adminId);
        var query = new Uri(url).Query.TrimStart('?').Split('&')
            .Select(part => part.Split('=', 2)).ToDictionary(part => part[0], part => Uri.UnescapeDataString(part[1]));
        Assert.Equal("existing-client", query["client_id"]);
        Assert.Equal("S256", query["code_challenge_method"]);
        Assert.Contains("https://www.googleapis.com/auth/gmail.send", query["scope"]);
        Assert.Null(service.Consume("forged-state"));
        var pending = service.Consume(query["state"]);
        Assert.NotNull(pending);
        Assert.Equal(adminId, pending.AdminId);
        Assert.Null(service.Consume(query["state"]));
    }

    [Fact]
    public void MimeHeadersPreserveUnicodeSenderAndRejectAddressInjection()
    {
        var mime = EmailService.CreateEmail("to@example.com", "from@example.com", "צוות DOMIX", "reply@example.com", "בדיקה", "<p>שלום</p>");
        Assert.Contains("Reply-To: reply@example.com\r\n", mime);
        Assert.Contains("From: =?UTF-8?B?", mime);
        Assert.Contains("Content-Transfer-Encoding: base64", mime);
        Assert.Throws<ArgumentException>(() => EmailService.CreateEmail("to@example.com\r\nBcc: victim@example.com", "from@example.com", "DOMIX", "", "Test", "body"));
    }
}
