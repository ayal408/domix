namespace serverApi.Models;

public class ApartmentRating
{
    public Guid ApartmentId { get; set; }
    public Guid UserId { get; set; }
    public int Score { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public Apartment Apartment { get; set; } = null!;
    public User User { get; set; } = null!;
}
