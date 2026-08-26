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
                var content = new FormUrlEncodedContent(data);
                var response = await client.PostAsync("https://oauth2.googleapis.com/token", content, cancellationToken);

                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
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
                _logger.LogError(ex, "Failed to retrieve Google OAuth access token.");
                throw;
            }
        }
    }
}