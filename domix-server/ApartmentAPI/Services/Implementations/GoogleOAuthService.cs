using System.Text.Json;
using Microsoft.Extensions.Logging;
using serverApi.Models;

namespace serverApi.Services.Implementations
{
    public class GoogleOAuthService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<GoogleOAuthService> _logger;

        public GoogleOAuthService(IHttpClientFactory httpClientFactory, ILogger<GoogleOAuthService> logger)
        {
            _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<string> GetAccessTokenAsync(GmailSettings settings, CancellationToken cancellationToken = default)
        {
            if (settings == null) throw new ArgumentNullException(nameof(settings));

            var client = _httpClientFactory.CreateClient("GoogleOAuth");

            var data = new Dictionary<string, string>
            {
                ["client_id"] = settings.ClientId,
                ["client_secret"] = settings.ClientSecret,
                ["refresh_token"] = settings.RefreshToken,
                ["grant_type"] = "refresh_token"
            };

            try
            {
                using var content = new FormUrlEncodedContent(data);
                using var response = await client.PostAsync("https://oauth2.googleapis.com/token", content, cancellationToken);

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    using var failure = JsonDocument.Parse(json);
                    if (failure.RootElement.TryGetProperty("error", out var error) && error.GetString() == "invalid_grant")
                        throw new GmailReconnectRequiredException();
                    throw new HttpRequestException("Google token service is unavailable.", null, response.StatusCode);
                }
                using var doc = JsonDocument.Parse(json);

                if (doc.RootElement.TryGetProperty("access_token", out var accessTokenElement))
                {
                    var accessToken = accessTokenElement.GetString();
                    if (!string.IsNullOrEmpty(accessToken))
                    {
                        return accessToken;
                    }
                }

                throw new InvalidOperationException("Access token was not found in Google OAuth response.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Google token request failed ({FailureType}).", ex.GetType().Name);
                throw;
            }
        }
    }
}
namespace serverApi.Services.Implementations
{
    public sealed class GmailReconnectRequiredException : Exception
    {
        public GmailReconnectRequiredException() : base("EMAIL_RECONNECT_REQUIRED") { }
    }
}
