using serverApi.Models.DTOs;

namespace serverApi.Services.Interfaces
{
    public interface IAnalyticsService
    {
        Task<AnalyticsSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default);
    }
}
