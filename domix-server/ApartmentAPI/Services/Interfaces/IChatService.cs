using serverApi.Models.DTOs;

namespace serverApi.Services.Interfaces
{
    public interface IChatService
    {
        IAsyncEnumerable<ChatStreamEvent> StreamReplyAsync(IReadOnlyList<ChatTurnDto> history, CancellationToken cancellationToken = default);
    }
}
