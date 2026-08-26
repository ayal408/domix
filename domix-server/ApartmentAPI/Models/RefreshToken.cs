namespace serverApi.Models
{
    public class RefreshToken
    {
        public int Id { get; set; }
        public string Token { get; set; } = string.Empty;
        public DateTime Created { get; set; } = DateTime.UtcNow;
        public DateTime Expires { get; set; }
        public bool IsRevoked { get; set; }
        public DateTime? RevokedAt { get; set; }
        public string ReplacedByToken { get; set; } = string.Empty;
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;
    }
}