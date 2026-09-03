namespace serverApi.Models
{
    public enum SupportTicketStatus
    {
        Open = 0,
        Resolved = 1
    }

    /// <summary>
    /// A visitor question routed to the site team from the chat widget's "Ask the team" option —
    /// kept separate from the user-to-user apartment `Message` inbox.
    /// </summary>
    public class SupportTicket
    {
        public Guid SupportTicketId { get; set; }

        /// <summary>Set when the sender was signed in; null for an anonymous visitor.</summary>
        public Guid? UserId { get; set; }
        public string? ContactName { get; set; }
        public string? ContactEmail { get; set; }

        public string Message { get; set; } = string.Empty;
        /// <summary>Plain-text snapshot of the chat conversation that led to this ticket, if any.</summary>
        public string? Transcript { get; set; }

        public SupportTicketStatus Status { get; set; } = SupportTicketStatus.Open;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ResolvedAt { get; set; }

        public User? User { get; set; }
    }
}
