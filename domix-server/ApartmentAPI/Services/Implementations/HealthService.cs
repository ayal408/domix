using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using serverApi.Data;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    public class HealthService : IHealthService
    {
        private readonly ApartmentContext _context;
        private readonly ILogger<HealthService> _logger;

        public HealthService(ApartmentContext context, ILogger<HealthService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<(bool IsHealthy, string? ErrorMessage)> CheckDatabaseAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                // בדיקת חיבור ויכולת הרצת שאילתות מול מסד הנתונים
                await _context.Database.ExecuteSqlRawAsync("SELECT 1", cancellationToken);
                return (true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Database health check failed.");
                return (false, ex.Message);
            }
        }
    }
}