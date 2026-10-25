using serverApi.Models;
namespace serverApi.Services.Implementations;

public static class ExchangeMatching
{
    public static DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTime.UtcNow, "Asia/Jerusalem"));
    public static bool Covers(Apartment apartment, DateOnly start, DateOnly end) =>
        apartment.ListingType == "Exchange" && apartment.Status == ApartmentStatus.Available &&
        apartment.AvailableFrom.HasValue && apartment.AvailableTo.HasValue &&
        apartment.AvailableFrom.Value <= start && apartment.AvailableTo.Value >= end;

    // Exact city matching prevents, for example, matching a similarly named neighbourhood.
    public static bool SameCity(string? left, string? right) =>
        !string.IsNullOrWhiteSpace(left) && !string.IsNullOrWhiteSpace(right) &&
        string.Equals(left.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);
}
