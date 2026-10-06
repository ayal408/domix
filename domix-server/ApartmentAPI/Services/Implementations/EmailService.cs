using System.Net;
using System.Net.Mail;
using System.Text;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Gmail.v1;
using Google.Apis.Services;
using serverApi.Data;
using serverApi.Models;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations;

public class EmailService(
    EmailConfigurationService configuration, GoogleOAuthService oauth, ApartmentContext db,
    IConfiguration serverConfiguration, ILogger<EmailService> logger) : IEmailService
{
    public async Task SendTestEmailAsync(string? recipientEmail = null, CancellationToken cancellationToken = default)
    {
        var target = recipientEmail ?? serverConfiguration["EmailSettings:TestRecipient"]
            ?? Environment.GetEnvironmentVariable("TEST_RECIPIENT_EMAIL");
        if (!IsMailbox(target)) throw new ArgumentException("A valid test recipient is required.");
        var settings = await configuration.GetAsync(cancellationToken);
        var body = settings.TestBody
            .Replace("{{DateTime}}", DateTime.UtcNow.ToString("dd/MM/yyyy HH:mm 'UTC'"))
            .Replace("{{Email}}", target);
        await SendEmailAsync(target!, settings.TestSubject,
            "<div dir=\"auto\">" + WebUtility.HtmlEncode(body).Replace("\n", "<br>") + "</div>", cancellationToken);
    }

    public async Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        if (!IsMailbox(to)) throw new ArgumentException("Invalid recipient email.", nameof(to));
        if (string.IsNullOrWhiteSpace(subject) || subject.Any(char.IsControl)) throw new ArgumentException("Invalid subject.", nameof(subject));
        var delivery = new EmailDelivery { Recipient = to, Subject = subject };
        try
        {
            var credentials = await configuration.GetCredentialsAsync(cancellationToken);
            var settings = await configuration.GetAsync(cancellationToken);
            var token = await oauth.GetAccessTokenAsync(credentials, cancellationToken);
            using var service = new GmailService(new BaseClientService.Initializer
            {
                HttpClientInitializer = GoogleCredential.FromAccessToken(token), ApplicationName = "DOMIX"
            });
            var body = htmlBody;
            if (!string.IsNullOrWhiteSpace(settings.Signature))
                body += "<hr><div dir=\"auto\">" + WebUtility.HtmlEncode(settings.Signature).Replace("\n", "<br>") + "</div>";
            var raw = CreateEmail(to, credentials.Email, settings.SenderName, settings.ReplyTo, subject, body);
            var message = new Google.Apis.Gmail.v1.Data.Message
            {
                Raw = Convert.ToBase64String(Encoding.UTF8.GetBytes(raw)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
            };
            await service.Users.Messages.Send(message, "me").ExecuteAsync(cancellationToken);
            delivery.Succeeded = true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            delivery.FailureCode = "EMAIL_SEND_FAILED";
            throw;
        }
        finally
        {
            if (!cancellationToken.IsCancellationRequested)
            {
                try { db.EmailDeliveries.Add(delivery); await db.SaveChangesAsync(cancellationToken); }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // A history failure must not turn an already-sent message into a retry/duplicate.
                    logger.LogWarning("Could not save email delivery history ({FailureType}).", ex.GetType().Name);
                }
            }
        }
    }

    internal static bool IsMailbox(string? address)
    {
        if (string.IsNullOrWhiteSpace(address) || address.Length > 254 || address.Any(char.IsControl)) return false;
        return MailAddress.TryCreate(address, out var parsed) && parsed.Address.Equals(address, StringComparison.OrdinalIgnoreCase);
    }

    internal static string CreateEmail(string to, string from, string senderName, string replyTo, string subject, string body)
    {
        if (!IsMailbox(to) || !IsMailbox(from) || (!string.IsNullOrEmpty(replyTo) && !IsMailbox(replyTo)))
            throw new ArgumentException("Invalid mail header address.");
        static string EncodeHeader(string value) => "=?UTF-8?B?" + Convert.ToBase64String(Encoding.UTF8.GetBytes(value)) + "?=";
        var headers = new List<string>
        {
            "To: " + to, "From: " + EncodeHeader(senderName) + " <" + from + ">",
            "Subject: " + EncodeHeader(subject), "MIME-Version: 1.0",
            "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: base64"
        };
        if (!string.IsNullOrEmpty(replyTo)) headers.Add("Reply-To: " + replyTo);
        return string.Join("\r\n", headers) + "\r\n\r\n" + Convert.ToBase64String(Encoding.UTF8.GetBytes(body), Base64FormattingOptions.InsertLineBreaks);
    }
}
