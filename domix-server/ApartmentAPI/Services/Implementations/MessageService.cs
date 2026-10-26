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
            string? apartmentSnapshot = null, offeredSnapshot = null;
            var anonymousRecipient = false;
            if (dto.ApartmentId.HasValue)
            {
                var listing = await _context.Apartments.AsNoTracking().FirstOrDefaultAsync(
                    a => a.ApartmentId == dto.ApartmentId, cancellationToken);
                if (listing == null) throw new KeyNotFoundException("הנכס אינו זמין");
                if (dto.OwnerId != Guid.Empty && dto.OwnerId != listing.UserId)
                    throw new ArgumentException("הנמען אינו בעל המודעה");
                dto.OwnerId = listing.UserId;
                anonymousRecipient = listing.IsAnonymous;
                apartmentSnapshot = listing.city + ", " + (listing.IsAnonymous ? listing.area : listing.address);
                if (dto.OfferedApartmentId.HasValue)
                {
                    var offer = await _context.Apartments.AsNoTracking().FirstOrDefaultAsync(
                        a => a.ApartmentId == dto.OfferedApartmentId && a.UserId == senderId, cancellationToken);
                    if (offer == null || senderId == dto.OwnerId || !dto.ExchangeStart.HasValue || !dto.ExchangeEnd.HasValue ||
                        dto.ExchangeStart < ExchangeMatching.Today || dto.ExchangeEnd <= dto.ExchangeStart ||
                        !ExchangeMatching.Covers(offer, dto.ExchangeStart.Value, dto.ExchangeEnd.Value) ||
                        !ExchangeMatching.Covers(listing, dto.ExchangeStart.Value, dto.ExchangeEnd.Value))
                        throw new ArgumentException("הצעת ההחלפה או התאריכים אינם תקינים");
                    offeredSnapshot = offer.city + ", " + offer.address;
                }
            }
            else if (dto.OfferedApartmentId.HasValue || dto.ExchangeStart.HasValue || dto.ExchangeEnd.HasValue)
                throw new ArgumentException("הצעת החלפה חייבת להיות משויכת לנכס");
            if (!dto.OfferedApartmentId.HasValue && (dto.ExchangeStart.HasValue || dto.ExchangeEnd.HasValue))
                throw new ArgumentException("יש לבחור דירה מוצעת להחלפה");
            var message = new Message
            {
                MessageId = Guid.NewGuid(),
                SenderId = senderId,
                OwnerId = dto.OwnerId,
                ApartmentId = dto.ApartmentId,
                OfferedApartmentId = dto.OfferedApartmentId,
                ExchangeStart = dto.ExchangeStart,
                ExchangeEnd = dto.ExchangeEnd,
                ApartmentSnapshot = apartmentSnapshot,
                OfferedApartmentSnapshot = offeredSnapshot,
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
                    var emailMessage = EmailText.Message("DOMIX", "התקבלה הודעה חדשה. לצפייה יש להיכנס לחשבון.", $"{clientAppUrl}/messages", owner.LanguagePreference);
                    await _emailService.SendEmailAsync(owner.EmailAddress, emailMessage.Subject, emailMessage.Html, cancellationToken);
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
                OwnerId = anonymousRecipient ? Guid.Empty : message.OwnerId,
                SenderName = sender?.IsDeleted == true ? "חשבון שנמחק" : sender?.UserName,
                ApartmentId = message.ApartmentId,
                OfferedApartmentId = message.OfferedApartmentId,
                ExchangeStart = message.ExchangeStart,
                ExchangeEnd = message.ExchangeEnd,
                ApartmentSnapshot = message.ApartmentSnapshot,
                OfferedApartmentSnapshot = message.OfferedApartmentSnapshot,
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
                .Where(m => m.OwnerId == ownerId && !m.IsArchived && !m.IsDeleted)
                .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.MessageId)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return await MapMessagesWithUsersAsync(messages, cancellationToken);
        }

        public async Task<IEnumerable<MessageResponseDto>> GetArchivedMessagesAsync(Guid ownerId, CancellationToken cancellationToken = default)
        {
            var messages = await _context.Messages
                .AsNoTracking()
                .Where(m => m.OwnerId == ownerId && m.IsArchived && !m.IsDeleted)
                .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.MessageId)
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

            var users = await _context.Users.IgnoreQueryFilters()
                .AsNoTracking()
                .Where(u => senderIds.Contains(u.UserId))
                .ToListAsync(cancellationToken);

            var avatars = new Dictionary<Guid, string?>();
            foreach (var user in users) avatars[user.UserId] = await PrivacyImages.AvatarAsync(user.ProfileImage, cancellationToken);
            return messages.Select(m =>
            {
                var sender = users.FirstOrDefault(u => u.UserId == m.SenderId);

                return new MessageResponseDto
                {
                    MessageId = m.MessageId,
                    SenderId = m.SenderId,
                    OwnerId = m.OwnerId,
                    SenderName = sender?.IsDeleted == true ? "חשבון שנמחק" : sender?.UserName,
                    ApartmentId = m.ApartmentId,
                    OfferedApartmentId = m.OfferedApartmentId,
                    ExchangeStart = m.ExchangeStart,
                    ExchangeEnd = m.ExchangeEnd,
                    ApartmentSnapshot = m.ApartmentSnapshot,
                    OfferedApartmentSnapshot = m.OfferedApartmentSnapshot,
                    Content = m.Content,
                    CreatedAt = m.CreatedAt,
                    IsRead = m.IsRead,
                    SenderImageBase64 = sender is null ? null : avatars.GetValueOrDefault(sender.UserId)
                };
            }).ToList();
        }
    }
}
