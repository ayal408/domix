namespace serverApi.Services.Interfaces
{
    public interface IHealthService
    {
        Task<(bool IsHealthy, string? ErrorMessage)> CheckDatabaseAsync(CancellationToken cancellationToken = default);
    }
}