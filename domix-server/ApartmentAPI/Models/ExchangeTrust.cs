namespace serverApi.Models;
public class ExchangeUserBlock
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid BlockedUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
public class ExchangeReview
{
    public Guid Id { get; set; }
    public Guid AgreementId { get; set; }
    public Guid ReviewerId { get; set; }
    public Guid ReviewedUserId { get; set; }
    public int Score { get; set; }
    public string Comment { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
public class ExchangeWatch
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid OfferedApartmentId { get; set; }
    public string Destination { get; set; } = "";
    public DateOnly Start { get; set; }
    public DateOnly End { get; set; }
    public int Guests { get; set; }
    public bool KosherKitchen { get; set; }
    public bool SeparateBeds { get; set; }
    public int? MaxSynagogueDistance { get; set; }
    public string Frequency { get; set; } = "Off";
    public string SeenIds { get; set; } = "";
    public int Revision { get; set; }
    public DateTime? LeaseUntil { get; set; }
    public DateTime LastSentAt { get; set; } = DateTime.UtcNow;
}
