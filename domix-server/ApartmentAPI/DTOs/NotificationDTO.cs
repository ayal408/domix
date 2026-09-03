namespace serverApi.Models.DTOs
{
    /// <summary>Body for <c>POST /api/Notification</c> — Admin/Manager only.</summary>
    public class CreateNotificationDto
    {
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    public class NotificationDto
    {
        public Guid NotificationId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string? CreatedByUserName { get; set; }
    }

    /// <summary>Response for <c>GET /api/Notification</c>.</summary>
    public class NotificationFeedDto
    {
        public List<NotificationDto> Notifications { get; set; } = new();
        public int UnreadCount { get; set; }
    }
}
