namespace serverApi.Models;

public class ExchangeAgreement
{
    public Guid Id { get; set; }
    public Guid RequesterId { get; set; }
    public Guid RecipientId { get; set; }
    public Guid OfferedApartmentId { get; set; }
    public Guid RequestedApartmentId { get; set; }
    public string OfferedHome { get; set; } = "";
    public string RequestedHome { get; set; } = "";
    public DateOnly Start { get; set; }
    public DateOnly End { get; set; }
    public int Guests { get; set; }
    public int? RecipientGuests { get; set; }
    public DateTime? RequesterCompletedAt { get; set; }
    public DateTime? RecipientCompletedAt { get; set; }
    [System.ComponentModel.DataAnnotations.Schema.NotMapped] public bool HasReviewed { get; set; }
    public string Note { get; set; } = "";
    // Sending the request is the requester's explicit consent; only the recipient can accept.
    public string Status { get; set; } = "Pending";
    public Guid? ReplacesId { get; set; }
    public int Revision { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class ExchangeCalendarPeriod
{
    public Guid Id { get; set; }
    public Guid ApartmentId { get; set; }
    public DateOnly Start { get; set; }
    public DateOnly End { get; set; }
    public bool IsAvailable { get; set; }
}
