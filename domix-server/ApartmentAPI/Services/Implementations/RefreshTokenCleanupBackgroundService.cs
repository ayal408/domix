using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    /// <summary>
    /// Periodically deletes revoked-refresh-token rows whose token has already expired on its
    /// own -- otherwise the denylist (see <see cref="IRefreshTokenService"/>) only ever grows,
    /// one row per logout, forever.
    /// </summary>
    public class RefreshTokenCleanupBackgroundService : BackgroundService
    {
        private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<RefreshTokenCleanupBackgroundService> _logger;

        public RefreshTokenCleanupBackgroundService(
            IServiceScopeFactory scopeFactory,
            ILogger<RefreshTokenCleanupBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(Interval);

            do
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var refreshTokenService = scope.ServiceProvider.GetRequiredService<IRefreshTokenService>();
                    var purged = await refreshTokenService.PurgeExpiredAsync(stoppingToken);
                    if (purged > 0)
                        _logger.LogInformation("Purged {Count} expired revoked-refresh-token row(s).", purged);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Revoked-refresh-token cleanup sweep failed.");
                }
            } while (await WaitForNextTickAsync(timer, stoppingToken));
        }

        private static async Task<bool> WaitForNextTickAsync(PeriodicTimer timer, CancellationToken stoppingToken)
        {
            try
            {
                return await timer.WaitForNextTickAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return false;
            }
        }
    }
}
