using System.ComponentModel.DataAnnotations;
namespace serverApi.Models;
public class UserBlock
{
    public Guid BlockerId { get; set; }
    public Guid BlockedId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
public class ListingReport
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReporterId { get; set; }
    public Guid? MessageId { get; set; }
    public Guid? ApartmentId { get; set; }
    [MaxLength(40)] public string Reason { get; set; } = "Other";
    [MaxLength(1000)] public string Details { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedBy { get; set; }
}
public class ConversationVisit
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ConversationId { get; set; }
    public Guid ParticipantA { get; set; }
    public Guid ParticipantB { get; set; }
    public Guid ProposedBy { get; set; }
    public DateTime StartsAt { get; set; }
    [MaxLength(20)] public string Status { get; set; } = "Pending";
    [ConcurrencyCheck] public Guid Revision { get; set; } = Guid.NewGuid();
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
