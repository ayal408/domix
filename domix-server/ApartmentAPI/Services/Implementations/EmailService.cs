using Google.Apis.Auth.OAuth2;
using Google.Apis.Gmail.v1;
using Google.Apis.Gmail.v1.Data;
using Google.Apis.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using serverApi.Models;
using serverApi.Services.Interfaces;
using System.Text;

namespace serverApi.Services.Implementations
{
    public class EmailService : IEmailService
    {
        private readonly GmailSettings _settings;
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailService> _logger;
        
        // מנגנון שמירת Token בזיכרון למניעת קריאות מיותרות לשרתי Google OAuth
        private string? _cachedAccessToken;
        private DateTime _tokenExpiration = DateTime.MinValue;
        private readonly SemaphoreSlim _tokenLock = new(1, 1);

        public EmailService(
            IOptions<GmailSettings> settings, 
            IConfiguration configuration, 
            ILogger<EmailService> logger)
        {
            _settings = settings?.Value ?? throw new ArgumentNullException(nameof(settings));
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        // שליחת מייל בדיקה מערכתי (כולל טעינת תבנית HTML)
        public async Task SendTestEmailAsync(string? recipientEmail = null, CancellationToken cancellationToken = default)
        {
            var targetEmail = recipientEmail 
                              ?? _configuration["EmailSettings:TestRecipient"] 
                              ?? Environment.GetEnvironmentVariable("TEST_RECIPIENT_EMAIL");

            if (string.IsNullOrWhiteSpace(targetEmail))
            {
                throw new InvalidOperationException("Recipient email address is not configured in environment variables or configuration.");
            }

            var templatePath = Path.Combine(AppContext.BaseDirectory, "EmailTemplates", "TestEmail.html");
            
            string html;
            if (File.Exists(templatePath))
            {
                html = await File.ReadAllTextAsync(templatePath, cancellationToken);
            }
            else
            {
                html = "<h1>System Test</h1><p>Time: {{DateTime}}</p><p>Server: {{Server}}</p><p>Target: {{Email}}</p>";
            }

            html = html
                .Replace("{{DateTime}}", DateTime.Now.ToString("dd/MM/yyyy HH:mm"))
                .Replace("{{Server}}", Environment.MachineName)
                .Replace("{{Email}}", targetEmail);

            await SendEmailAsync(targetEmail, "בדיקת מערכת DOMIX", html, cancellationToken);
        }

        // שליחת אימייל גנרית דרך Gmail API
        public async Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(to))
                throw new ArgumentException("Recipient email cannot be null or empty.", nameof(to));
            
            if (string.IsNullOrWhiteSpace(subject))
                throw new ArgumentException("Email subject cannot be null or empty.", nameof(subject));

            try
            {
                var accessToken = await GetAccessTokenAsync(cancellationToken);
                var credential = GoogleCredential.FromAccessToken(accessToken)
                    .CreateScoped(GmailService.Scope.GmailSend);

                var service = new GmailService(new BaseClientService.Initializer()
                {
                    HttpClientInitializer = credential,
                    ApplicationName = "Apartment App"
                });

                var rawMessage = CreateEmail(to, _settings.Email, subject, htmlBody);
                var gmailMessage = new Google.Apis.Gmail.v1.Data.Message
                {
                    Raw = Base64UrlEncode(rawMessage)
                };

                await service.Users.Messages.Send(gmailMessage, "me").ExecuteAsync(cancellationToken);
                _logger.LogInformation("Email successfully sent via Gmail API to {Recipient}", to);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email via Gmail API to {Recipient}", to);
                throw;
            }
        }

        private async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken)
        {
            // בדיקה האם ה-Token הקיים עדיין תקף (עם מרווח בטחון של 5 דקות)
            if (!string.IsNullOrEmpty(_cachedAccessToken) && DateTime.UtcNow < _tokenExpiration.AddMinutes(-5))
            {
                return _cachedAccessToken;
            }

            await _tokenLock.WaitAsync(cancellationToken);
            try
            {
                // בדיקה כפולה לאחר נעילה (Double-check locking pattern)
                if (!string.IsNullOrEmpty(_cachedAccessToken) && DateTime.UtcNow < _tokenExpiration.AddMinutes(-5))
                {
                    return _cachedAccessToken;
                }

                var clientSecrets = new ClientSecrets
                {
                    ClientId = _settings.ClientId,
                    ClientSecret = _settings.ClientSecret
                };

                var flow = new Google.Apis.Auth.OAuth2.Flows.GoogleAuthorizationCodeFlow(
                    new Google.Apis.Auth.OAuth2.Flows.GoogleAuthorizationCodeFlow.Initializer
                    {
                        ClientSecrets = clientSecrets,
                        Scopes = new[] { GmailService.Scope.GmailSend }
                    });

                var token = new Google.Apis.Auth.OAuth2.Responses.TokenResponse
                {
                    RefreshToken = _settings.RefreshToken
                };

                var cred = new UserCredential(flow, "user", token);
                await cred.RefreshTokenAsync(cancellationToken);

                if (string.IsNullOrEmpty(cred.Token?.AccessToken))
                {
                    throw new InvalidOperationException("Failed to refresh Google OAuth access token.");
                }

                _cachedAccessToken = cred.Token.AccessToken;
                
                // קביעת תוקף ה-Token (בדרך כלל שעה אחת בגוגל)
                var expiresInSeconds = cred.Token.ExpiresInSeconds ?? 3600;
                _tokenExpiration = DateTime.UtcNow.AddSeconds(expiresInSeconds);

                return _cachedAccessToken;
            }
            finally
            {
                _tokenLock.Release();
            }
        }

        private static string CreateEmail(string to, string from, string subject, string body)
        {
            var encodedSubject = $"=?UTF-8?B?{Convert.ToBase64String(Encoding.UTF8.GetBytes(subject))}?=";
            return 
$@"To: {to}
From: DOMIX <{from}>
Subject: {encodedSubject}
Content-Type: text/html; charset=utf-8
MIME-Version: 1.0
Content-Transfer-Encoding: 8bit

{body}";
        }

        private static string Base64UrlEncode(string input)
        {
            var bytes = Encoding.UTF8.GetBytes(input);
            return Convert.ToBase64String(bytes)
                .Replace("+", "-")
                .Replace("/", "_")
                .Replace("=", "");
        }
    }
}