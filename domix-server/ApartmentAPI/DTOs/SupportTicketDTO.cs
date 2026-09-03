using serverApi.Models;

namespace serverApi.Models.DTOs
{
    /// <summary>Body for <c>POST /api/Support</c>. Open to anonymous visitors, same as the chat endpoint.</summary>
    public class CreateSupportTicketDto
    {
        /// <summary>Required when the sender isn't signed in, so the team has a way to reply.</summary>
        public string? ContactName { get; set; }
        public string? ContactEmail { get; set; }
        public string Message { get; set; } = string.Empty;
        /// <summary>The chat conversation so far, if the visitor escalated from the chat widget.</summary>
        public List<ChatTurnDto>? Transcript { get; set; }
    }

    public class SupportTicketDto
    {
        public Guid SupportTicketId { get; set; }
        public Guid? UserId { get; set; }
        public string? UserName { get; set; }
        public string? ContactName { get; set; }
        public string? ContactEmail { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? Transcript { get; set; }
        public SupportTicketStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
    }
}
