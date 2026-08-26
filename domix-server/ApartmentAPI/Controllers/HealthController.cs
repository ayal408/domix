using Microsoft.AspNetCore.Mvc;
using serverApi.Services.Interfaces;

namespace serverApi.Controllers
{
    [ApiController]
    [Route("api/health")]
    public class HealthController : ControllerBase
    {
        private readonly IHealthService _healthService;
        private readonly ILogger<HealthController> _logger;

        public HealthController(IHealthService healthService, ILogger<HealthController> logger)
        {
            _healthService = healthService;
            _logger = logger;
        }

        [HttpGet("db-query")]
        public async Task<IActionResult> CheckDbQuery(CancellationToken cancellationToken)
        {
            var (isHealthy, errorMessage) = await _healthService.CheckDatabaseAsync(cancellationToken);

            if (isHealthy)
            {
                return Ok(new
                {
                    status = "healthy",
                    timestamp = DateTime.UtcNow
                });
            }

            return StatusCode(500, new
            {
                status = "error",
                message = errorMessage ?? "Database is unreachable."
            });
        }
    }
}