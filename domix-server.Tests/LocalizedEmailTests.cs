using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;

namespace domix_server.Tests;

public class LocalizedEmailTests
{
    private static ApartmentContext Context() => new(new DbContextOptionsBuilder<ApartmentContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Theory]
    [InlineData(null, "he", "rtl")]
    [InlineData("unknown", "he", "rtl")]
    [InlineData("he-IL", "he", "rtl")]
    [InlineData("en-US", "en", "ltr")]
    [InlineData("es", "es", "ltr")]
    [InlineData("fr", "fr", "ltr")]
    public void TransactionalEmailsUseRecipientLanguageAndEncodeUserContent(string? language, string expected, string direction)
    {
        var verify = EmailText.Verification("<script>alert(1)</script>", "https://domix.test/verify?token=abc&next=home", language);
        var reset = EmailText.PasswordReset("<script>", "https://domix.test/reset?token=abc", language);
        var message = EmailText.Message("<script>", "<img src=x onerror=alert(1)>", "https://domix.test/messages", language);
        foreach (var mail in new[] { verify, reset, message })
        {
            Assert.Contains($"lang=\"{expected}\" dir=\"{direction}\"", mail.Html);
            Assert.Contains("DOMIX", mail.Html);
            Assert.Contains("border-radius:12px", mail.Html);
            Assert.DoesNotContain("<script>", mail.Html);
            Assert.DoesNotContain("<img src=x", mail.Html);
        }
        Assert.Contains("token=abc&amp;next=home", verify.Html);
        Assert.Contains("&lt;script&gt;", verify.Html);
        if (expected == "he") Assert.Contains("אימות", verify.Subject);
    }

    [Fact]
    public async Task RegistrationPersistsLanguageBeforeSendingFirstVerificationEmail()
    {
        await using var db = Context();
        var email = new RecordingEmail();
        var service = new UserService(db, email, new ConfigurationBuilder().Build(), NullLogger<UserService>.Instance);
        var result = await service.CreateUserAsync(new UserDto
        {
            UserName = "NewUser", EmailAddress = "new@example.com", RegistrationMethod = "Password",
            LanguagePreference = "fr-FR",
        });
        Assert.Equal("fr", result.LanguagePreference);
        Assert.Equal("fr", (await db.Users.SingleAsync()).LanguagePreference);
        Assert.Single(email.Messages);
        Assert.Contains("lang=\"fr\"", email.Messages[0].Html);
        Assert.Contains("Confirmez", email.Messages[0].Subject);
    }

    [Fact]
    public async Task SupportUsesSystemSenderInboxAndSendsLocalizedReceipt()
    {
        await using var db = Context();
        db.SystemEmailSettings.Add(new SystemEmailSettings { Email = "support@example.com" });
        var user = new User { UserId = Guid.NewGuid(), UserName = "Visitor", EmailAddress = "visitor@example.com", LanguagePreference = "fr" };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        var email = new RecordingEmail();
        var service = new SupportService(db, email, new ConfigurationBuilder().Build(), NullLogger<SupportService>.Instance);
        var ticket = await service.CreateAsync(new CreateSupportTicketDto { Message = "Help <script>please</script>" }, user.UserId);
        Assert.Equal(2, email.Messages.Count);
        Assert.Equal("support@example.com", email.Messages[0].To);
        Assert.Contains("פנייה חדשה", email.Messages[0].Subject);
        Assert.Equal("visitor@example.com", email.Messages[1].To);
        Assert.Contains("lang=\"fr\"", email.Messages[1].Html);
        Assert.Contains(ticket.SupportTicketId.ToString(), email.Messages[1].Html);
        Assert.DoesNotContain("<script>", email.Messages[1].Html);
        Assert.Equal(1, await db.SupportTickets.CountAsync());
    }

    [Fact]
    public async Task SupportDeliveryFailureKeepsTicketAndStillAttemptsReceipt()
    {
        await using var db = Context();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ADMIN_NOTIFICATION_EMAIL"] = "team@example.com" }).Build();
        var email = new RecordingEmail { FailTo = "team@example.com" };
        var service = new SupportService(db, email, config, NullLogger<SupportService>.Instance);
        var result = await service.CreateAsync(new CreateSupportTicketDto { ContactEmail = "guest@example.com", Message = "Help", LanguagePreference = "es" }, null);
        Assert.Equal(2, email.Messages.Count);
        Assert.Contains("lang=\"es\"", email.Messages[1].Html);
        Assert.NotNull(await db.SupportTickets.FindAsync(result.SupportTicketId));
    }

    private sealed class RecordingEmail : IEmailService
    {
        public string? FailTo { get; init; }
        public List<(string To, string Subject, string Html)> Messages { get; } = new();
        public Task SendTestEmailAsync(string? recipientEmail = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
        {
            Messages.Add((to, subject, htmlBody));
            if (to == FailTo) throw new InvalidOperationException("Delivery unavailable");
            return Task.CompletedTask;
        }
    }
}
