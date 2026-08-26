namespace serverApi.Models.DTOs
{
    public class CreateMessageDto
    {
        public Guid SenderId { get; set; }
        public Guid OwnerId { get; set; }
        public required string Content { get; set; }
    }

    public class MessageResponseDto
    {
        public Guid MessageId { get; set; }
        public Guid SenderId { get; set; }
        public string? SenderName { get; set; }
        public Guid OwnerId { get; set; }
        public string? OwnerName { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsRead { get; set; } = false;
        public DateTime? ReadAt { get; set; }
        public string? SenderImageBase64 { get; set; }
        public bool IsDeleted { get; set; } = false;
        public bool IsArchived { get; set; } = false;
        public DateTime? ArchivedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
    }
}