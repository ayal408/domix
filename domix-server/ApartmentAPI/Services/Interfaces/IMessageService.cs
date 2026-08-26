using serverApi.Models.DTOs;

namespace serverApi.Services.Interfaces
{
    public interface IMessageService
    {
        Task<MessageResponseDto> SendMessageAsync(CreateMessageDto dto, Guid senderId, CancellationToken cancellationToken = default);
        Task<IEnumerable<MessageResponseDto>> GetOwnerMessagesAsync(Guid ownerId, int page, int pageSize, CancellationToken cancellationToken = default);
        Task<IEnumerable<MessageResponseDto>> GetArchivedMessagesAsync(Guid ownerId, CancellationToken cancellationToken = default);
        Task<bool> ArchiveMessageAsync(Guid messageId, Guid ownerId, CancellationToken cancellationToken = default);
        Task<bool> DeleteMessageAsync(Guid messageId, Guid ownerId, CancellationToken cancellationToken = default);
        Task<bool> MarkAsReadAsync(Guid messageId, Guid ownerId, CancellationToken cancellationToken = default);
    }
}