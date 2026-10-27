using serverApi.Models.DTOs;

namespace serverApi.Services.Interfaces
{
    public interface IMessageService
    {
        Task<MessageResponseDto> ReplyAsync(Guid messageId, Guid senderId, string content, CancellationToken cancellationToken = default);
        Task NotifySavedMessageAsync(Guid id, CancellationToken cancellationToken = default);
        Task<IEnumerable<MessageResponseDto>> GetThreadAsync(Guid thread, Guid viewer, Guid? beforeId, CancellationToken ct);
        Task<MessageResponseDto> SendToThreadAsync(Guid thread, Guid viewer, string content, CancellationToken ct);
        Task<object[]> ThreadsAsync(Guid viewer, int offset, CancellationToken ct);
        Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<MessageResponseDto> SendMessageAsync(CreateMessageDto dto, Guid senderId, CancellationToken cancellationToken = default);
        Task<IEnumerable<MessageResponseDto>> GetOwnerMessagesAsync(Guid ownerId, int page, int pageSize, CancellationToken cancellationToken = default);
        Task<IEnumerable<MessageResponseDto>> GetArchivedMessagesAsync(Guid ownerId, CancellationToken cancellationToken = default);
        Task<bool> ArchiveMessageAsync(Guid messageId, Guid ownerId, CancellationToken cancellationToken = default);
        Task<bool> DeleteMessageAsync(Guid messageId, Guid ownerId, CancellationToken cancellationToken = default);
        Task<bool> MarkAsReadAsync(Guid messageId, Guid ownerId, CancellationToken cancellationToken = default);
    }
}