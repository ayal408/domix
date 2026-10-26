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
            var dispatcher = scope.ServiceProvider.GetRequiredService<SavedSearchEmailDispatcher>();
            await dispatcher.DispatchAsync(cancellationToken);
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
                    await context.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
                    {
                        context.ChangeTracker.Clear();
                        // Row lock serializes enqueue across replicas. The digest and watermark commit together.
                        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
                        var current = await context.SavedSearches.FromSqlInterpolated(
                            $@"SELECT * FROM ""SavedSearches"" WHERE ""SavedSearchId"" = {savedSearch.SavedSearchId} FOR UPDATE")
                            .SingleOrDefaultAsync(cancellationToken);
                        if (current is null) return;
                        var matches = (await savedSearchService.FindNewMatchesAsync(current, cancellationToken))
                            .Where(x => x.dateInsert <= now).ToList();
                        if (matches.Count == 0)
                            return;

                        var user = await context.Users
                            .AsNoTracking()
                            .FirstOrDefaultAsync(u => u.UserId == savedSearch.UserId, cancellationToken);

                        if (string.IsNullOrWhiteSpace(user?.EmailAddress))
                        {
                            // No address to notify -- leave LastNotifiedAt alone so these matches are
                            // still picked up (and an email attempted) on a later sweep, e.g. once the
                            // user adds an email address, rather than being silently skipped forever.
                            return;
                        }

                        var html = BuildDigestHtml(savedSearch.Name, matches, _configuration, user.LanguagePreference);
                        context.SavedSearchEmails.Add(new Models.SavedSearchEmail
                        {
                            SavedSearchId = current.SavedSearchId, FromAt = current.LastNotifiedAt, ThroughAt = now,
                            Recipient = user.EmailAddress,
                            Subject = EmailText.MatchesTitle(savedSearch.Name, matches.Count, user.LanguagePreference), HtmlBody = html
                    });
                    current.LastNotifiedAt = now;
                    await context.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    });
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to process saved search {SavedSearchId}", savedSearch.SavedSearchId);
                    context.ChangeTracker.Clear();
                }
            }
            await dispatcher.DispatchAsync(cancellationToken);
        }

        private static string BuildDigestHtml(string searchName, IReadOnlyCollection<Models.DTOs.ApartmentDTO> matches, IConfiguration configuration, string? language)
        {
            var sb = new StringBuilder();
            sb.Append(EmailText.Paragraph(EmailText.MatchesTitle(searchName, matches.Count, language)));
            sb.Append("<ul style=\"margin:0;padding-inline-start:20px;\">");
            foreach (var apartment in matches)
            {
                sb.Append("<li style=\"margin-bottom:6px;\">")
                  .Append(System.Net.WebUtility.HtmlEncode(apartment.city)).Append(" · ").Append(System.Net.WebUtility.HtmlEncode(apartment.area))
                  .Append(" — ").Append(apartment.price).Append(" ₪")
                  .Append("</li>");
            }
            sb.Append("</ul>");

            var clientAppUrl = (configuration["CLIENT_APP_URL"] ?? "http://localhost").TrimEnd('/');
            return EmailTemplates.Render(
                EmailText.MatchesTitle(searchName, matches.Count, language), sb.ToString(),
                EmailText.Pick(language, "צפייה בחיפושים השמורים", "View your saved searches", "Ver búsquedas guardadas", "Voir vos recherches enregistrées"),
                $"{clientAppUrl}/saved-searches", language);
        }
    }
}
