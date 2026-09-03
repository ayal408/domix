using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    public class AnalyticsService : IAnalyticsService
    {
        private readonly ApartmentContext _context;

        public AnalyticsService(ApartmentContext context)
        {
            _context = context;
        }

        public async Task<AnalyticsSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default)
        {
            var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);

            return new AnalyticsSummaryDto
            {
                TotalUsers = await _context.Users.CountAsync(cancellationToken),
                VerifiedUsers = await _context.Users.CountAsync(u => u.IsEmailVerified, cancellationToken),
                BlockedUsers = await _context.Users.CountAsync(u => u.IsBlocked, cancellationToken),
                NewUsersLast7Days = await _context.Users.CountAsync(u => u.JoiningDate >= sevenDaysAgo, cancellationToken),

                TotalApartments = await _context.Apartments.CountAsync(cancellationToken),
                AvailableApartments = await _context.Apartments.CountAsync(a => a.Status == ApartmentStatus.Available, cancellationToken),
                RentedApartments = await _context.Apartments.CountAsync(a => a.Status == ApartmentStatus.Rented, cancellationToken),
                SoldApartments = await _context.Apartments.CountAsync(a => a.Status == ApartmentStatus.Sold, cancellationToken),
                NewApartmentsLast7Days = await _context.Apartments.CountAsync(a => a.dateInsert >= sevenDaysAgo, cancellationToken),

                OpenSupportTickets = await _context.SupportTickets.CountAsync(t => t.Status == SupportTicketStatus.Open, cancellationToken),
            };
        }
    }
}
