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

            var today = ExchangeMatching.Today;
            var exchangeHomes = _context.Apartments.Where(a => a.ListingType == "Exchange" &&
                a.Status == ApartmentStatus.Available && a.AvailableFrom.HasValue && a.AvailableTo > today &&
                a.AvailableFrom < a.AvailableTo && !_context.Users.Any(u => u.UserId == a.UserId && u.IsBlocked));
            var inquiries = _context.Messages.Where(m => m.OfferedApartmentId.HasValue &&
                m.ExchangeStart.HasValue && m.ExchangeEnd.HasValue && m.CreatedAt >= sevenDaysAgo && !m.IsDeleted);
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

                AvailableExchangeHomes = await exchangeHomes.CountAsync(cancellationToken),
                ExchangeSupplyByCity = await exchangeHomes.GroupBy(a => a.city.Trim()).Select(g => new ExchangeCitySupplyDto { City = g.Key, Homes = g.Count() })
                    .OrderByDescending(g => g.Homes).ThenBy(g => g.City).ToListAsync(cancellationToken),
                ExchangeInquiriesLast7Days = await inquiries.CountAsync(cancellationToken),
                ExchangeSeekersLast7Days = await inquiries.Select(m => m.SenderId).Distinct().CountAsync(cancellationToken),
                ExchangeInquiriesWithReplyLast7Days = await inquiries.CountAsync(m => _context.Messages.Any(r =>
                    !r.IsDeleted && r.SenderId == m.OwnerId && r.OwnerId == m.SenderId &&
                    r.ApartmentId == m.ApartmentId && r.CreatedAt > m.CreatedAt), cancellationToken),
                OpenSupportTickets = await _context.SupportTickets.CountAsync(t => t.Status == SupportTicketStatus.Open, cancellationToken),
            };
        }
    }
}
