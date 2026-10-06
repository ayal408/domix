using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    public class SupportService : ISupportService
    {
        private readonly ApartmentContext _context;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<SupportService> _logger;

        public SupportService(ApartmentContext context, IEmailService emailService, IConfiguration configuration, ILogger<SupportService> logger)
        {
            _context = context;
            _emailService = emailService;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<SupportTicketDto> CreateAsync(CreateSupportTicketDto dto, Guid? userId, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(dto.Message))
                throw new ArgumentException("Message is required.");

            if (userId is null && string.IsNullOrWhiteSpace(dto.ContactEmail))
                throw new ArgumentException("An email address is required so the team can reply.");

            var ticket = new SupportTicket
            {
                SupportTicketId = Guid.NewGuid(),
                UserId = userId,
                ContactName = dto.ContactName?.Trim(),
                ContactEmail = dto.ContactEmail?.Trim(),
                Message = dto.Message.Trim(),
                Transcript = FormatTranscript(dto.Transcript, dto.LanguagePreference),
                Status = SupportTicketStatus.Open,
                CreatedAt = DateTime.UtcNow,
            };

            _context.SupportTickets.Add(ticket);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Support ticket {TicketId} created (user {UserId}).", ticket.SupportTicketId, userId);

            if (ticket.UserId.HasValue)
                ticket.User = await _context.Users.FirstOrDefaultAsync(u => u.UserId == ticket.UserId.Value, cancellationToken);
            var language = EmailText.Language(dto.LanguagePreference ?? ticket.User?.LanguagePreference);
            await NotifyAdminAsync(ticket, cancellationToken);
            await SendReceiptAsync(ticket, language, cancellationToken);

            return await ToDtoAsync(ticket, cancellationToken);
        }

        public async Task<IEnumerable<SupportTicketDto>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            var tickets = await _context.SupportTickets
                .Include(t => t.User)
                .AsNoTracking()
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync(cancellationToken);

            return tickets.Select(ToDto);
        }

        public async Task<SupportTicketDto?> ResolveAsync(Guid ticketId, CancellationToken cancellationToken = default)
        {
            var ticket = await _context.SupportTickets
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.SupportTicketId == ticketId, cancellationToken);

            if (ticket == null)
                return null;

            ticket.Status = SupportTicketStatus.Resolved;
            ticket.ResolvedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            return ToDto(ticket);
        }

        private static string? FormatTranscript(List<ChatTurnDto>? transcript, string? language)
        {
            if (transcript == null || transcript.Count == 0)
                return null;

            return string.Join("\n\n", transcript.Select(turn => $"{(turn.Role == "user" ? EmailText.Pick(language, "פונה", "Visitor", "Visitante", "Visiteur") : EmailText.Pick(language, "עוזר", "Assistant", "Asistente", "Assistant"))}: {turn.Text}"));
        }

        private async Task NotifyAdminAsync(SupportTicket ticket, CancellationToken cancellationToken)
        {
            var adminEmail = _configuration["ADMIN_NOTIFICATION_EMAIL"];
            if (string.IsNullOrWhiteSpace(adminEmail))
                adminEmail = await _context.SystemEmailSettings.AsNoTracking().Where(x => x.Id == 1)
                    .Select(x => x.Email).SingleOrDefaultAsync(cancellationToken) ?? _configuration["Gmail:Email"];
            if (!EmailService.IsMailbox(adminEmail))
            {
                _logger.LogWarning("No support recipient configured for ticket {TicketId}.", ticket.SupportTicketId);
                return;
            }
            var admin = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.EmailAddress == adminEmail, cancellationToken);
            var recipientLanguage = admin?.LanguagePreference ?? "he";
            var from = ticket.ContactName ?? ticket.User?.UserName ?? ticket.ContactEmail ??
                EmailText.Pick(recipientLanguage, "משתמש", "User", "Usuario", "Utilisateur");
            var contact = ticket.ContactEmail ?? ticket.User?.EmailAddress;
            if (!string.IsNullOrWhiteSpace(contact)) from += " (" + contact + ")";
            var clientAppUrl = (_configuration["CLIENT_APP_URL"] ?? "http://localhost").TrimEnd('/');
            var mail = EmailText.Support(from, ticket.Message, ticket.Transcript, ticket.SupportTicketId.ToString(),
                $"{clientAppUrl}/admin/support", recipientLanguage, receipt: false);

            try
            {
                await _emailService.SendEmailAsync(adminEmail!, mail.Subject, mail.Html, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                // The ticket is already saved and visible in the admin inbox — a failed notification
                // email must not fail the visitor's request.
                _logger.LogError(ex, "Failed to send admin notification for support ticket {TicketId}.", ticket.SupportTicketId);
            }
        }

        private async Task SendReceiptAsync(SupportTicket ticket, string language, CancellationToken ct)
        {
            var recipient = ticket.User?.EmailAddress ?? ticket.ContactEmail;
            if (!EmailService.IsMailbox(recipient)) return;
            var mail = EmailText.Support(ticket.ContactName ?? ticket.User?.UserName ?? "", ticket.Message, null,
                ticket.SupportTicketId.ToString(), "", language, receipt: true);
            try { await _emailService.SendEmailAsync(recipient!, mail.Subject, mail.Html, ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception ex) { _logger.LogWarning("Support receipt failed for {TicketId} ({FailureType}).", ticket.SupportTicketId, ex.GetType().Name); }
        }

        private async Task<SupportTicketDto> ToDtoAsync(SupportTicket ticket, CancellationToken cancellationToken)
        {
            if (ticket.UserId.HasValue && ticket.User == null)
            {
                ticket.User = await _context.Users.AsNoTracking()
                    .FirstOrDefaultAsync(u => u.UserId == ticket.UserId.Value, cancellationToken);
            }

            return ToDto(ticket);
        }

        private static SupportTicketDto ToDto(SupportTicket ticket) => new SupportTicketDto
        {
            SupportTicketId = ticket.SupportTicketId,
            UserId = ticket.UserId,
            UserName = ticket.User?.UserName,
            ContactName = ticket.ContactName,
            ContactEmail = ticket.ContactEmail ?? ticket.User?.EmailAddress,
            Message = ticket.Message,
            Transcript = ticket.Transcript,
            Status = ticket.Status,
            CreatedAt = ticket.CreatedAt,
            ResolvedAt = ticket.ResolvedAt,
        };
    }
}
