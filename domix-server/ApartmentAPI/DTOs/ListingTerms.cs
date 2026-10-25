using System.ComponentModel.DataAnnotations;

namespace serverApi.Models.DTOs;

// DateOnly is intentional: availability is a calendar interval, not a UTC timestamp.
public class ListingTerms : IValidatableObject
{
    [Range(1, 30)] public int? GuestCapacity { get; set; }
    public bool? KosherKitchen { get; set; }
    public bool? SeparateBeds { get; set; }
    [Range(0, 10000)] public int? SynagogueDistanceMeters { get; set; }
    [MaxLength(1000)] public string? KitchenNotes { get; set; }
    [MaxLength(1000)] public string? ShabbatNotes { get; set; }
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
