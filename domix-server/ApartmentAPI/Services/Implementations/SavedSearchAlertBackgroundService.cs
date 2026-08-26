using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using serverApi.Data;
using serverApi.Services.Interfaces;
using System.Text;

namespace serverApi.Services.Implementations
{
    /// <summary>
    /// Periodically checks every saved search for newly-inserted matching listings and
    /// emails the owner a digest via the existing <see cref="IEmailService"/>. A failure
    /// sending one search's email (e.g. Gmail credentials not configured in this
    /// environment) is logged and never stops the loop or crashes the host.
    /// </summary>
    public class SavedSearchAlertBackgroundService : BackgroundService
    {
        private const int DefaultIntervalMinutes = 15;

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<SavedSearchAlertBackgroundService> _logger;

        public SavedSearchAlertBackgroundService(
            IServiceScopeFactory scopeFactory,
            IConfiguration configuration,
            ILogger<SavedSearchAlertBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _configuration = configuration;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var interval = TimeSpan.FromMinutes(
                _configuration.GetValue<int?>("SavedSearchAlerts:IntervalMinutes") ?? DefaultIntervalMinutes);

            using var timer = new PeriodicTimer(interval);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckSavedSearchesAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Saved search alert sweep failed.");
                }

                try
                {
                    await timer.WaitForNextTickAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        private async Task CheckSavedSearchesAsync(CancellationToken cancellationToken)
        {
            using var scope = _scopeFactory.CreateScope();
            var savedSearchService = scope.ServiceProvider.GetRequiredService<ISavedSearchService>();
            var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
            var context = scope.ServiceProvider.GetRequiredService<ApartmentContext>();

            var savedSearches = await savedSearchService.GetAllAsync(cancellationToken);
            if (savedSearches.Count == 0)
                return;

            var now = DateTime.UtcNow;

            foreach (var savedSearch in savedSearches)
            {
                cancellationToken.ThrowIfCancellationRequested();

                try
                {
                    var matches = await savedSearchService.FindNewMatchesAsync(savedSearch, cancellationToken);
                    if (matches.Count == 0)
                        continue;

                    var user = await context.Users
                        .AsNoTracking()
                        .FirstOrDefaultAsync(u => u.UserId == savedSearch.UserId, cancellationToken);

                    if (!string.IsNullOrWhiteSpace(user?.EmailAddress))
                    {
                        var html = BuildDigestHtml(savedSearch.Name, matches);
                        await emailService.SendEmailAsync(user.EmailAddress, $"DOMIX — {matches.Count} new match(es) for \"{savedSearch.Name}\"", html, cancellationToken);
                    }

                    await savedSearchService.MarkNotifiedAsync(savedSearch.SavedSearchId, now, cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to process saved search {SavedSearchId}", savedSearch.SavedSearchId);
                }
            }
        }

        private static string BuildDigestHtml(string searchName, IReadOnlyCollection<Models.DTOs.ApartmentDTO> matches)
        {
            var sb = new StringBuilder();
            sb.Append("<h2>New listings for \"").Append(searchName).Append("\"</h2><ul>");
            foreach (var apartment in matches)
            {
                sb.Append("<li>")
                  .Append(apartment.city).Append(" · ").Append(apartment.area)
                  .Append(" — ").Append(apartment.price).Append(" ₪")
                  .Append("</li>");
            }
            sb.Append("</ul>");
            return sb.ToString();
        }
    }
}
