using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using serverApi.Hubs;
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
        private readonly IHubContext<PresenceHub>? _hub;

        public MessageService(
            ApartmentContext context,
            IEmailService emailService,
            IConfiguration configuration,
            ILogger<MessageService> logger, IHubContext<PresenceHub>? hub = null)
        {
            _context = context;
            _emailService = emailService;
            _configuration = configuration;
            _logger = logger;
            _hub = hub;
        }

        public Task<MessageResponseDto> SendMessageAsync(CreateMessageDto dto, Guid senderId, CancellationToken cancellationToken = default) =>
            SendCoreAsync(dto, senderId, null, cancellationToken);

        public async Task<MessageResponseDto> ReplyAsync(Guid messageId, Guid senderId, string content, CancellationToken cancellationToken = default)
        {
            // Only the authenticated recipient may reply. Never accept a recipient or anonymity flag from the client.
            var original = await _context.Messages.AsNoTracking().FirstOrDefaultAsync(
                m => m.MessageId == messageId && m.OwnerId == senderId && !m.IsDeleted, cancellationToken);
            if (original == null) throw new KeyNotFoundException("Message not found");
            if (original.SenderId == senderId) throw new ArgumentException("Cannot reply to yourself");
            return await SendCoreAsync(new CreateMessageDto { OwnerId = original.SenderId, Content = content }, senderId, original, cancellationToken);
        }

        private async Task<MessageResponseDto> SendCoreAsync(CreateMessageDto dto, Guid senderId, Message? replyTo, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(dto.Content) || dto.Content.Trim().Length > 2000)
                throw new ArgumentException("Message must contain between 1 and 2000 characters");
            var sender = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == senderId && !u.IsBlocked, cancellationToken);
            // Listing contact may omit the recipient; resolve it below before validating availability.
            string? apartmentSnapshot = null, offeredSnapshot = null;
            var anonymousRecipient = replyTo?.SenderIsAnonymous ?? false;
            var anonymousSender = replyTo?.RecipientIsAnonymous ?? false;
            if (replyTo != null)
            {
                dto.ApartmentId = replyTo.ApartmentId;
                apartmentSnapshot = replyTo.ApartmentSnapshot;
                // Replies preserve listing context without creating a new exchange proposal.
            }
            else if (dto.ApartmentId.HasValue)
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
            var owner = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == dto.OwnerId && !u.IsBlocked, cancellationToken);
            if (sender == null || owner == null) throw new KeyNotFoundException("Account is unavailable");
            if (await _context.UserBlocks.AnyAsync(b => (b.BlockerId == senderId && b.BlockedId == dto.OwnerId) || (b.BlockerId == dto.OwnerId && b.BlockedId == senderId), cancellationToken))
                throw new ArgumentException("Messaging unavailable");
            var message = new Message
            {
                ConversationId = ConversationKey(senderId, dto.OwnerId, dto.ApartmentId),
                MessageId = Guid.NewGuid(),
                SenderId = senderId,
                OwnerId = dto.OwnerId,
                ApartmentId = dto.ApartmentId,
                OfferedApartmentId = dto.OfferedApartmentId,
                ExchangeStart = dto.ExchangeStart,
                ExchangeEnd = dto.ExchangeEnd,
                ApartmentSnapshot = apartmentSnapshot,
                OfferedApartmentSnapshot = offeredSnapshot,
                SenderIsAnonymous = anonymousSender,
                RecipientIsAnonymous = anonymousRecipient,
                Content = dto.Content.Trim(),
                CreatedAt = DateTime.UtcNow,
                IsRead = false,
                IsDeleted = false,
                IsArchived = false
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync(cancellationToken);

            await NotifySavedMessageAsync(message.MessageId, cancellationToken);

            return new MessageResponseDto
            {
                ConversationId = message.ConversationId,
                IsMine = true,
                MessageId = message.MessageId,
                SenderId = anonymousSender ? Guid.Empty : message.SenderId,
                OwnerId = anonymousRecipient ? Guid.Empty : message.OwnerId,
                SenderIsAnonymous = anonymousSender,
                SenderName = anonymousSender ? null : sender.UserName,
                ApartmentId = message.ApartmentId,
                OfferedApartmentId = message.OfferedApartmentId,
                ExchangeStart = message.ExchangeStart,
                ExchangeEnd = message.ExchangeEnd,
                ApartmentSnapshot = message.ApartmentSnapshot,
                OfferedApartmentSnapshot = message.OfferedApartmentSnapshot,
                Content = message.Content,
                CreatedAt = message.CreatedAt,
                IsRead = message.IsRead,
                SenderImageBase64 = anonymousSender ? null : await PrivacyImages.AvatarAsync(sender.ProfileImage, cancellationToken)
            };
        }

        public static Guid ConversationKey(Guid first, Guid second, Guid? apartment)
        {
            var ids = new[] { first.ToString("D"), second.ToString("D") }; Array.Sort(ids, StringComparer.Ordinal);
            var bytes = System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes($"{ids[0]}:{ids[1]}:{(apartment ?? Guid.Empty):D}"));
            return Guid.Parse(Convert.ToHexString(bytes)); // identifier only, never an authorization token
        }
        public async Task NotifySavedMessageAsync(Guid id, CancellationToken cancellationToken = default)
        {
            var message = await _context.Messages.AsNoTracking().SingleAsync(m => m.MessageId == id, cancellationToken);
            var sender = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == message.SenderId, cancellationToken);
            var owner = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == message.OwnerId, cancellationToken);
            if (sender == null || owner == null) return;
            var senderId = sender.UserId;
            // Publish only after persistence, only to the recipient's authenticated group.
            if (_hub is not null && owner is not null && senderId != owner.UserId)
            {
                try { await _hub.Clients.Group(PresenceHub.MessageGroup(owner.UserId)).SendAsync("MessageReceived", new { message.MessageId }, cancellationToken); }
                catch (Exception ex) { _logger.LogWarning("Message delivery event failed ({FailureType}).", ex.GetType().Name); }
            }

            if (!string.IsNullOrEmpty(sender.EmailAddress) && !string.IsNullOrEmpty(owner?.EmailAddress) && owner.ReceiveMessageEmails && senderId != owner.UserId)
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

        }
        public async Task<IEnumerable<MessageResponseDto>> GetThreadAsync(Guid thread, Guid viewer, Guid? beforeId, CancellationToken ct)
        {
            var query = _context.Messages.AsNoTracking().Where(m => m.ConversationId == thread && !m.IsDeleted && (m.SenderId == viewer || m.OwnerId == viewer));
            if (beforeId.HasValue)
            {
                var before = await query.FirstOrDefaultAsync(m => m.MessageId == beforeId, ct);
                if (before == null) return Array.Empty<MessageResponseDto>();
                query = query.Where(m => m.CreatedAt < before.CreatedAt || (m.CreatedAt == before.CreatedAt && m.MessageId.CompareTo(before.MessageId) < 0));
            }
            var messages = await query
                .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.MessageId).Take(50).ToListAsync(ct);
            return await MapMessagesWithUsersAsync(messages, ct, viewer);
        }
        public async Task<MessageResponseDto> SendToThreadAsync(Guid thread, Guid viewer, string content, CancellationToken ct)
        {
            var anchor = await _context.Messages.AsNoTracking().Where(m => m.ConversationId == thread && !m.IsDeleted && (m.SenderId == viewer || m.OwnerId == viewer))
                .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.MessageId).FirstOrDefaultAsync(ct);
            if (anchor == null) throw new KeyNotFoundException();
            if (anchor.SenderId == viewer) anchor = new Message { SenderId = anchor.OwnerId, OwnerId = viewer, ApartmentId = anchor.ApartmentId,
                ApartmentSnapshot = anchor.ApartmentSnapshot, SenderIsAnonymous = anchor.RecipientIsAnonymous, RecipientIsAnonymous = anchor.SenderIsAnonymous };
            if (anchor.SenderId == viewer) throw new ArgumentException();
            return await SendCoreAsync(new CreateMessageDto { OwnerId = anchor.SenderId, Content = content }, viewer, anchor, ct);
        }
        public async Task<object[]> ThreadsAsync(Guid viewer, int offset, CancellationToken ct)
        {
            var summaries = await _context.Messages.AsNoTracking().Where(m => !m.IsDeleted && (m.SenderId == viewer || m.OwnerId == viewer))
                .GroupBy(m => m.ConversationId).Select(g => new { Id = g.Key, LastAt = g.Max(m => m.CreatedAt), Unread = g.Count(m => m.OwnerId == viewer && !m.IsRead && !m.IsArchived) })
                .OrderByDescending(t => t.LastAt).ThenBy(t => t.Id).Skip(Math.Max(0, offset)).Take(30).ToListAsync(ct);
            var ids = summaries.Select(s => s.Id).ToList();
            var anchors = await _context.Messages.AsNoTracking().Where(m => ids.Contains(m.ConversationId) && !m.IsDeleted && (m.SenderId == viewer || m.OwnerId == viewer))
                .GroupBy(m => m.ConversationId).Select(g => g.OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.MessageId).First()).ToListAsync(ct);
            return summaries.Select(s => { var a = anchors.Single(m => m.ConversationId == s.Id); return (object)new { s.Id, s.LastAt, s.Unread, a.ApartmentId, a.ApartmentSnapshot }; }).ToArray();
        }

        public Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default) =>
            _context.Messages.CountAsync(m => m.OwnerId == userId && !m.IsRead && !m.IsDeleted && !m.IsArchived, cancellationToken);

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

            return await MapMessagesWithUsersAsync(messages, cancellationToken, ownerId);
        }

        public async Task<IEnumerable<MessageResponseDto>> GetArchivedMessagesAsync(Guid ownerId, CancellationToken cancellationToken = default)
        {
            var messages = await _context.Messages
                .AsNoTracking()
                .Where(m => m.OwnerId == ownerId && m.IsArchived && !m.IsDeleted)
                .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.MessageId)
                .ToListAsync(cancellationToken);

            return await MapMessagesWithUsersAsync(messages, cancellationToken, ownerId);
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

        private async Task<IEnumerable<MessageResponseDto>> MapMessagesWithUsersAsync(List<Message> messages, CancellationToken cancellationToken, Guid? viewer = null)
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
                    ConversationId = m.ConversationId,
                    IsMine = m.SenderId == viewer,
                    MessageId = m.MessageId,
                    SenderId = m.SenderIsAnonymous ? Guid.Empty : m.SenderId,
                    OwnerId = m.RecipientIsAnonymous ? Guid.Empty : m.OwnerId,
                    SenderIsAnonymous = m.SenderIsAnonymous,
                    SenderName = m.SenderIsAnonymous ? null : sender?.IsDeleted == true ? "חשבון שנמחק" : sender?.UserName,
                    ApartmentId = m.ApartmentId,
                    OfferedApartmentId = m.OfferedApartmentId,
                    ExchangeStart = m.ExchangeStart,
                    ExchangeEnd = m.ExchangeEnd,
                    ApartmentSnapshot = m.ApartmentSnapshot,
                    OfferedApartmentSnapshot = m.OfferedApartmentSnapshot,
                    Content = m.Content,
                    CreatedAt = m.CreatedAt,
                    IsRead = m.IsRead,
                    IsArchived = m.IsArchived,
                    SenderImageBase64 = m.SenderIsAnonymous || sender is null ? null : avatars.GetValueOrDefault(sender.UserId)
                };
            }).ToList();
        }
    }
}
