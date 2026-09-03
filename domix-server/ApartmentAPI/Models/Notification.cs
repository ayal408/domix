namespace serverApi.Models
{
    /// <summary>An admin-broadcast announcement, pushed live to every connected client via NotificationHub.</summary>
    public class Notification
    {
        public Guid NotificationId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Guid? CreatedByUserId { get; set; }
        public User? CreatedByUser { get; set; }
    }
}
