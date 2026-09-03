using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    /// <summary>
    /// Looks up real Israeli city/street names from data.gov.il's public street registry (dataset
    /// 321, Central Bureau of Statistics — ~1,272 cities, ~63k city/street pairs). No API key needed.
    ///
    /// The registry's own full-text search (the API's <c>q</c> parameter) only matches whole,
    /// stemmed words — a live-typed prefix like "דיז" never matches "דיזנגוף" — so prefix-style
    /// autocomplete isn't possible through it. Instead this fetches the (small) full city list once,
    /// and a city's full street list once per city, caches each in memory, and does the actual
    /// prefix/substring filtering here.
    /// </summary>
    public class IsraeliAddressService : IIsraeliAddressService
    {
        private const string CitiesResourceId = "b7cf8f14-64a2-4b33-8d4b-edb286fdbd37";
        private const string StreetsResourceId = "9ad3862c-8391-4b2f-84a4-2d4c68625f4b";
        private const string BaseUrl = "https://data.gov.il/api/3/action/datastore_search";
        private const string CityCodeField = "סמל_ישוב";
        private const string CityNameField = "שם_ישוב";
        private const string StreetNameField = "שם_רחוב";
        private const string AllCitiesCacheKey = "address:all-cities";
        private static readonly TimeSpan CitiesCacheDuration = TimeSpan.FromHours(24);
        private static readonly TimeSpan StreetsCacheDuration = TimeSpan.FromHours(1);

        private readonly HttpClient _httpClient;
        private readonly IMemoryCache _cache;
        private readonly ILogger<IsraeliAddressService> _logger;

        public IsraeliAddressService(HttpClient httpClient, IMemoryCache cache, ILogger<IsraeliAddressService> logger)
        {
            _httpClient = httpClient;
            _cache = cache;
            _logger = logger;
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("ApartmentApp/1.0");
        }

        public async Task<IReadOnlyList<string>> SearchCitiesAsync(string query, CancellationToken cancellationToken = default)
        {
            var trimmed = query?.Trim() ?? string.Empty;
            if (trimmed.Length < 2)
                return Array.Empty<string>();

            var cities = await GetAllCitiesAsync(cancellationToken);
            return cities
                .Where(c => c.Name.Contains(trimmed, StringComparison.OrdinalIgnoreCase))
                .Select(c => c.Name)
                .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)
                .Take(10)
                .ToList();
        }

        public async Task<IReadOnlyList<string>> SearchStreetsAsync(string city, string query, CancellationToken cancellationToken = default)
        {
            var trimmedCity = city?.Trim() ?? string.Empty;
            var trimmedQuery = query?.Trim() ?? string.Empty;
            if (trimmedCity.Length == 0 || trimmedQuery.Length < 2)
                return Array.Empty<string>();

            var cities = await GetAllCitiesAsync(cancellationToken);
            var match = cities.FirstOrDefault(c => string.Equals(c.Name, trimmedCity, StringComparison.OrdinalIgnoreCase));
            if (match.Name == null)
                return Array.Empty<string>();

            var streets = await GetStreetsForCityAsync(match.Code, cancellationToken);
            return streets
                .Where(s => s.Contains(trimmedQuery, StringComparison.OrdinalIgnoreCase))
                .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)
                .Take(10)
                .ToList();
        }

        private async Task<IReadOnlyList<(int Code, string Name)>> GetAllCitiesAsync(CancellationToken cancellationToken)
        {
            if (_cache.TryGetValue(AllCitiesCacheKey, out IReadOnlyList<(int Code, string Name)>? cached) && cached != null)
                return cached;

            var url = $"{BaseUrl}?resource_id={CitiesResourceId}&limit=2000";
            var records = await FetchRecordsAsync(url, cancellationToken);

            var cities = records
                .Select(record => (
                    Code: record.TryGetValue(CityCodeField, out var codeEl) && codeEl.TryGetInt32(out var code) ? code : (int?)null,
                    Name: record.TryGetValue(CityNameField, out var nameEl) && nameEl.ValueKind == JsonValueKind.String ? nameEl.GetString()?.Trim() : null
                ))
                .Where(c => c.Code.HasValue && !string.IsNullOrWhiteSpace(c.Name))
                .Select(c => (Code: c.Code!.Value, Name: c.Name!))
                .Distinct()
                .ToList() as IReadOnlyList<(int Code, string Name)>;

            _cache.Set(AllCitiesCacheKey, cities, CitiesCacheDuration);
            return cities;
        }

        private async Task<IReadOnlyList<string>> GetStreetsForCityAsync(int cityCode, CancellationToken cancellationToken)
        {
            var cacheKey = $"address:streets-for-city:{cityCode}";
            if (_cache.TryGetValue(cacheKey, out IReadOnlyList<string>? cached) && cached != null)
                return cached;

            var filters = Uri.EscapeDataString(JsonSerializer.Serialize(new Dictionary<string, int> { [CityCodeField] = cityCode }));
            var url = $"{BaseUrl}?resource_id={StreetsResourceId}&filters={filters}&limit=5000";
            var records = await FetchRecordsAsync(url, cancellationToken);

            var streets = records
                .Select(record => record.TryGetValue(StreetNameField, out var el) && el.ValueKind == JsonValueKind.String ? el.GetString()?.Trim() : null)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Select(name => name!)
                .Distinct()
                .ToList() as IReadOnlyList<string>;

            _cache.Set(cacheKey, streets, StreetsCacheDuration);
            return streets;
        }

        private async Task<List<Dictionary<string, JsonElement>>> FetchRecordsAsync(string url, CancellationToken cancellationToken)
        {
            try
            {
                var response = await _httpClient.GetFromJsonAsync<DatastoreSearchResponse>(url, cancellationToken);
                return response?.Result?.Records ?? new List<Dictionary<string, JsonElement>>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to query data.gov.il datastore_search at {Url}", url);
                return new List<Dictionary<string, JsonElement>>();
            }
        }

        private class DatastoreSearchResponse
        {
            [JsonPropertyName("result")]
            public DatastoreResult? Result { get; set; }
        }

        private class DatastoreResult
        {
            [JsonPropertyName("records")]
            public List<Dictionary<string, JsonElement>>? Records { get; set; }
        }
    }
}
