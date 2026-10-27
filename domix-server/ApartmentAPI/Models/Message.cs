using System;

namespace serverApi.Models
{
    public class Message
    {
        public Guid MessageId { get; set; }
        public Guid SenderId { get; set; }
        public Guid OwnerId { get; set; }
        public Guid? ApartmentId { get; set; }
        public Guid? OfferedApartmentId { get; set; }
        public DateOnly? ExchangeStart { get; set; }
        public DateOnly? ExchangeEnd { get; set; }
        public string? ApartmentSnapshot { get; set; }
        public string? OfferedApartmentSnapshot { get; set; }
        public bool SenderIsAnonymous { get; set; }
        public bool RecipientIsAnonymous { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsRead { get; set; } = false;
        public DateTime? ReadAt { get; set; }
        public bool IsDeleted { get; set; } = false;
        public bool IsArchived { get; set; } = false;
        public DateTime? ArchivedAt { get; set; }
        public DateTime? DeletedAt { get; set; }

        public User Sender { get; set; } = null!;
        public User Owner { get; set; } = null!;
    }
}