using serverApi.Models.DTOs;

namespace serverApi.Services.Interfaces
{
    public interface ISupportService
    {
        /// <summary>Throws <see cref="ArgumentException"/> when the message is blank, or the sender is
        /// both unauthenticated and gave no contact email (the team would have no way to reply).</summary>
        Task<SupportTicketDto> CreateAsync(CreateSupportTicketDto dto, Guid? userId, CancellationToken cancellationToken = default);

        Task<IEnumerable<SupportTicketDto>> GetAllAsync(CancellationToken cancellationToken = default);

        /// <summary>Returns null when no ticket with the given id exists.</summary>
        Task<SupportTicketDto?> ResolveAsync(Guid ticketId, CancellationToken cancellationToken = default);
    }
}
