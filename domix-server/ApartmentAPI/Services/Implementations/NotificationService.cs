using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Hubs;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    public class NotificationService : INotificationService
    {
        private const int FeedSize = 50;

        private readonly ApartmentContext _context;
        private readonly IHubContext<PresenceHub> _hub;
        private readonly ILogger<NotificationService> _logger;

        public NotificationService(ApartmentContext context, IHubContext<PresenceHub> hub, ILogger<NotificationService> logger)
        {
            _context = context;
            _hub = hub;
            _logger = logger;
        }

        public async Task<NotificationDto> CreateAsync(CreateNotificationDto dto, Guid createdByUserId, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Message))
                throw new ArgumentException("Title and message are required.");

            var notification = new Notification
            {
                NotificationId = Guid.NewGuid(),
                Title = dto.Title.Trim(),
                Message = dto.Message.Trim(),
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = createdByUserId,
            };

            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync(cancellationToken);

            var createdBy = await _context.Users.AsNoTracking()
                .Where(u => u.UserId == createdByUserId)
                .Select(u => u.UserName)
                .FirstOrDefaultAsync(cancellationToken);

            var result = ToDto(notification, createdBy);

            // PresenceHub already holds one connection per signed-in tab (see PresenceConnector on the
            // client) — reused here instead of standing up a second hub just for this broadcast.
            await _hub.Clients.All.SendAsync("NotificationPosted", result, cancellationToken);

            _logger.LogInformation("Notification {NotificationId} broadcast by {UserId}.", notification.NotificationId, createdByUserId);
            return result;
        }

        public async Task<NotificationFeedDto> GetFeedAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var account = await _context.Users.AsNoTracking().Where(u => u.UserId == userId)
                .Select(u => new { u.NotificationsSeenAt, u.NotificationsDismissedAt }).SingleAsync(cancellationToken);
            var seenAt = account.NotificationsSeenAt;
            var dismissedAt = account.NotificationsDismissedAt;

            var notifications = await _context.Notifications
                .Where(n => dismissedAt == null || n.CreatedAt > dismissedAt)
                .Include(n => n.CreatedByUser)
                .AsNoTracking()
                .OrderByDescending(n => n.CreatedAt)
                .Take(FeedSize)
                .ToListAsync(cancellationToken);

            var unreadCount = seenAt == null
                ? notifications.Count
                : notifications.Count(n => n.CreatedAt > seenAt);

            return new NotificationFeedDto
            {
                Notifications = notifications.Select(n => ToDto(n, n.CreatedByUser?.UserName)).ToList(),
                UnreadCount = unreadCount,
            };
        }

        public async Task MarkSeenAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
            if (user == null) return;

            user.NotificationsSeenAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task DismissThroughAsync(Guid userId, DateTime through, CancellationToken cancellationToken = default)
        {
            if (through.Kind != DateTimeKind.Utc || through > DateTime.UtcNow)
                throw new ArgumentException("Invalid notification cutoff.");
            // Monotonic and scoped to the authenticated user; never deletes shared announcements.
            await _context.Users.Where(u => u.UserId == userId && (u.NotificationsDismissedAt == null || u.NotificationsDismissedAt < through))
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.NotificationsDismissedAt, through), cancellationToken);
        }

        private static NotificationDto ToDto(Notification notification, string? createdByUserName) => new NotificationDto
        {
            NotificationId = notification.NotificationId,
            Title = notification.Title,
            Message = notification.Message,
            CreatedAt = notification.CreatedAt,
            CreatedByUserName = createdByUserName,
        };
    }
}
