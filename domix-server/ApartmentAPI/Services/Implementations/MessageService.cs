using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    public class MessageService : IMessageService
    {
        private readonly ApartmentContext _context;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<MessageService> _logger;

        public MessageService(
            ApartmentContext context,
            IEmailService emailService,
            IConfiguration configuration,
            ILogger<MessageService> logger)
        {
            _context = context;
            _emailService = emailService;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<MessageResponseDto> SendMessageAsync(CreateMessageDto dto, Guid senderId, CancellationToken cancellationToken = default)
        {
            var message = new Message
            {
                MessageId = Guid.NewGuid(),
                SenderId = senderId,
                OwnerId = dto.OwnerId,
                Content = dto.Content,
                CreatedAt = DateTime.UtcNow,
                IsRead = false,
                IsDeleted = false,
                IsArchived = false
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync(cancellationToken);

            var sender = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.UserId == senderId, cancellationToken);

            var owner = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.UserId == dto.OwnerId, cancellationToken);

            if (sender == null)
            {
                throw new KeyNotFoundException("Sender not found");
            }

            if (!string.IsNullOrEmpty(sender.EmailAddress) && !string.IsNullOrEmpty(owner?.EmailAddress))
            {
                try
                {
                    var clientAppUrl = (_configuration["CLIENT_APP_URL"] ?? "http://localhost").TrimEnd('/');
                    var encodedName = System.Net.WebUtility.HtmlEncode(sender.UserName);
                    var body = $"<p>You have a new message from {encodedName}:</p>" +
                               $"<p style=\"white-space:pre-wrap\">{System.Net.WebUtility.HtmlEncode(dto.Content)}</p>";

                    await _emailService.SendEmailAsync(
                        owner.EmailAddress,
                        "New DOMIX message",
                        EmailTemplates.Render($"New message from {encodedName}", body, "Reply on DOMIX", $"{clientAppUrl}/messages"),
                        cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send email notification for message {MessageId}", message.MessageId);
                }
            }

            return new MessageResponseDto
            {
                MessageId = message.MessageId,
                SenderId = message.SenderId,
                OwnerId = message.OwnerId,
                SenderName = sender?.UserName,
                Content = message.Content,
                CreatedAt = message.CreatedAt,
                IsRead = message.IsRead,
                SenderImageBase64 = sender?.ProfileImage != null
                    ? Convert.ToBase64String(sender.ProfileImage)
                    : null
            };
        }

        public async Task<IEnumerable<MessageResponseDto>> GetOwnerMessagesAsync(Guid ownerId, int page, int pageSize, CancellationToken cancellationToken = default)
        {
            if (page < 1) page = 1;
            if (pageSize > 100) pageSize = 100;

            var messages = await _context.Messages
                .AsNoTracking()
                .Where(m => m.OwnerId == ownerId && !m.IsArchived)
                .OrderByDescending(m => m.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return await MapMessagesWithUsersAsync(messages, cancellationToken);
        }

        public async Task<IEnumerable<MessageResponseDto>> GetArchivedMessagesAsync(Guid ownerId, CancellationToken cancellationToken = default)
        {
            var messages = await _context.Messages
                .AsNoTracking()
                .Where(m => m.OwnerId == ownerId && m.IsArchived)
                .OrderByDescending(m => m.CreatedAt)
                .ToListAsync(cancellationToken);

            return await MapMessagesWithUsersAsync(messages, cancellationToken);
        }

        public async Task<bool> ArchiveMessageAsync(Guid messageId, Guid ownerId, CancellationToken cancellationToken = default)
        {
            var message = await _context.Messages
                .FirstOrDefaultAsync(m => m.MessageId == messageId && m.OwnerId == ownerId, cancellationToken);

            if (message == null) return false;

            message.IsArchived = true;
            message.ArchivedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<bool> DeleteMessageAsync(Guid messageId, Guid ownerId, CancellationToken cancellationToken = default)
        {
            var message = await _context.Messages
                .FirstOrDefaultAsync(m => m.MessageId == messageId && m.OwnerId == ownerId, cancellationToken);

            if (message == null) return false;

            _context.Messages.Remove(message);
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<bool> MarkAsReadAsync(Guid messageId, Guid ownerId, CancellationToken cancellationToken = default)
        {
            var message = await _context.Messages
                .FirstOrDefaultAsync(m => m.MessageId == messageId && m.OwnerId == ownerId, cancellationToken);

            if (message == null) return false;

            message.IsRead = true;
            message.ReadAt = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        private async Task<IEnumerable<MessageResponseDto>> MapMessagesWithUsersAsync(List<Message> messages, CancellationToken cancellationToken)
        {
            var senderIds = messages.Select(m => m.SenderId).Distinct().ToList();

            var users = await _context.Users
                .AsNoTracking()
                .Where(u => senderIds.Contains(u.UserId))
                .ToListAsync(cancellationToken);

            return messages.Select(m =>
            {
                var sender = users.FirstOrDefault(u => u.UserId == m.SenderId);

                return new MessageResponseDto
                {
                    MessageId = m.MessageId,
                    SenderId = m.SenderId,
                    OwnerId = m.OwnerId,
                    SenderName = sender?.UserName,
                    Content = m.Content,
                    CreatedAt = m.CreatedAt,
                    IsRead = m.IsRead,
                    SenderImageBase64 = sender?.ProfileImage != null
                        ? Convert.ToBase64String(sender.ProfileImage)
                        : null
                };
            }).ToList();
        }
    }
}