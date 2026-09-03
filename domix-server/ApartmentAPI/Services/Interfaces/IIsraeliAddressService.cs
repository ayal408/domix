namespace serverApi.Services.Interfaces
{
    /// <summary>
    /// Looks up real Israeli city/street names from data.gov.il's public street registry, so
    /// apartment listings are constrained to actual places instead of free text.
    /// </summary>
    public interface IIsraeliAddressService
    {
        /// <summary>Up to 10 city names matching <paramref name="query"/>. Empty for a query under 2 characters.</summary>
        Task<IReadOnlyList<string>> SearchCitiesAsync(string query, CancellationToken cancellationToken = default);

        /// <summary>Up to 10 street names in <paramref name="city"/> matching <paramref name="query"/>.</summary>
        Task<IReadOnlyList<string>> SearchStreetsAsync(string city, string query, CancellationToken cancellationToken = default);
    }
}
