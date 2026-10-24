using System.ComponentModel.DataAnnotations;

namespace serverApi.Models.DTOs;

// DateOnly is intentional: availability is a calendar interval, not a UTC timestamp.
public class ListingTerms : IValidatableObject
{
    public string ListingType { get; set; } = "Unspecified";
    public DateOnly? AvailableFrom { get; set; }
    public DateOnly? AvailableTo { get; set; }
    [MaxLength(100)] public string? DesiredCity { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ListingType is not ("Unspecified" or "Exchange" or "Rent" or "Sale"))
            yield return new("סוג עסקה אינו תקין", new[] { nameof(ListingType) });
        if (ListingType == "Exchange" && (AvailableFrom == null || AvailableTo == null || string.IsNullOrWhiteSpace(DesiredCity)))
            yield return new("להחלפה יש לבחור תאריכים ויעד מבוקש", new[] { nameof(AvailableFrom), nameof(AvailableTo), nameof(DesiredCity) });
        if (AvailableFrom.HasValue && AvailableTo.HasValue && AvailableTo <= AvailableFrom)
            yield return new("תאריך היציאה צריך להיות מאוחר מתאריך הכניסה", new[] { nameof(AvailableTo) });
    }
}
