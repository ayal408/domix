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
                Transcript = FormatTranscript(dto.Transcript),
                Status = SupportTicketStatus.Open,
                CreatedAt = DateTime.UtcNow,
            };

            _context.SupportTickets.Add(ticket);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Support ticket {TicketId} created (user {UserId}).", ticket.SupportTicketId, userId);

            await NotifyAdminAsync(ticket, cancellationToken);

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

        private static string? FormatTranscript(List<ChatTurnDto>? transcript)
        {
            if (transcript == null || transcript.Count == 0)
                return null;

            return string.Join("\n\n", transcript.Select(turn => $"{(turn.Role == "user" ? "Visitor" : "Assistant")}: {turn.Text}"));
        }

        private async Task NotifyAdminAsync(SupportTicket ticket, CancellationToken cancellationToken)
        {
            var adminEmail = _configuration["ADMIN_NOTIFICATION_EMAIL"];
            if (string.IsNullOrWhiteSpace(adminEmail))
            {
                _logger.LogWarning("ADMIN_NOTIFICATION_EMAIL is not set — skipping notification for support ticket {TicketId}.", ticket.SupportTicketId);
                return;
            }

            var from = string.IsNullOrWhiteSpace(ticket.ContactName) ? (ticket.ContactEmail ?? "a signed-in user") : ticket.ContactName;
            var body = $"<p><strong>From:</strong> {System.Net.WebUtility.HtmlEncode(from)}" +
                       (ticket.ContactEmail != null ? $" ({System.Net.WebUtility.HtmlEncode(ticket.ContactEmail)})" : "") +
                       $"</p><p>{System.Net.WebUtility.HtmlEncode(ticket.Message).Replace("\n", "<br/>")}</p>" +
                       (ticket.Transcript != null ? $"<hr/><p style=\"white-space:pre-wrap\">{System.Net.WebUtility.HtmlEncode(ticket.Transcript)}</p>" : "");

            var clientAppUrl = (_configuration["CLIENT_APP_URL"] ?? "http://localhost").TrimEnd('/');

            try
            {
                await _emailService.SendEmailAsync(
                    adminEmail,
                    "New DOMIX support question",
                    EmailTemplates.Render("New support question", body, "Open the support inbox", $"{clientAppUrl}/admin/support"),
                    cancellationToken);
            }
            catch (Exception ex)
            {
                // The ticket is already saved and visible in the admin inbox — a failed notification
                // email must not fail the visitor's request.
                _logger.LogError(ex, "Failed to send admin notification for support ticket {TicketId}.", ticket.SupportTicketId);
            }
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
