using serverApi.Models.DTOs;

namespace serverApi.Services.Interfaces
{
    public interface INotificationService
    {
        /// <summary>Creates the announcement, persists it, and broadcasts it live to every connected client.</summary>
        Task<NotificationDto> CreateAsync(CreateNotificationDto dto, Guid createdByUserId, CancellationToken cancellationToken = default);

        /// <summary>The most recent announcements plus how many are unread for this user.</summary>
        Task<NotificationFeedDto> GetFeedAsync(Guid userId, CancellationToken cancellationToken = default);

        /// <summary>Marks every announcement up to now as read for this user.</summary>
        Task MarkSeenAsync(Guid userId, CancellationToken cancellationToken = default);
    }
}
