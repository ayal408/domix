namespace serverApi.Models;

/// <summary>A durable digest. Sending/Unknown are never automatically replayed.</summary>
public class SavedSearchEmail
{
    public int MatchCount { get; set; }
    public bool SiteVisible { get; set; } = true;
    public DateTime? SeenAt { get; set; }
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SavedSearchId { get; set; }
    public SavedSearch SavedSearch { get; set; } = null!;
    public DateTime FromAt { get; set; }
    public DateTime ThroughAt { get; set; }
    public string Recipient { get; set; } = "";
    public string Subject { get; set; } = "";
    public string HtmlBody { get; set; } = "";
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AttemptedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? FailureCode { get; set; }
}
