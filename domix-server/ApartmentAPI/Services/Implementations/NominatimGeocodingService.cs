using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    public class NominatimGeocodingService : IGeocodingService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<NominatimGeocodingService> _logger;

        public NominatimGeocodingService(HttpClient httpClient, ILogger<NominatimGeocodingService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("ApartmentApp/1.0");
        }

        public async Task<(double? Latitude, double? Longitude)> GetCoordinatesAsync(string city, string address, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(address))
                return (null, null);

            try
            {
                var query = Uri.EscapeDataString($"{address}, {city}, Israel");
                var url = $"https://nominatim.openstreetmap.org/search?format=json&q={query}";

                var results = await _httpClient.GetFromJsonAsync<List<NominatimResult>>(url, cancellationToken);

                if (results != null && results.Count > 0)
                {
                    var first = results[0];
                    if (!string.IsNullOrEmpty(first.DisplayName) && first.DisplayName.Contains(city, StringComparison.OrdinalIgnoreCase))
                    {
                        if (double.TryParse(first.Lat, out var lat) && double.TryParse(first.Lon, out var lon))
                        {
                            return (lat, lon);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch geocoding coordinates for City: {City}, Address: {Address}", city, address);
            }

            return (null, null);
        }

        private class NominatimResult
        {
            [JsonPropertyName("lat")]
            public string Lat { get; set; } = string.Empty;

            [JsonPropertyName("lon")]
            public string Lon { get; set; } = string.Empty;

            [JsonPropertyName("display_name")]
            public string DisplayName { get; set; } = string.Empty;
        }
    }
}