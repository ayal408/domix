namespace serverApi.Models.DTOs
{
    /// <summary>Response for <c>GET /api/Analytics/summary</c> — the admin dashboard's headline counts.</summary>
    public class AnalyticsSummaryDto
    {
        public int TotalUsers { get; set; }
        public int VerifiedUsers { get; set; }
        public int BlockedUsers { get; set; }
        public int NewUsersLast7Days { get; set; }

        public int TotalApartments { get; set; }
        public int AvailableApartments { get; set; }
        public int RentedApartments { get; set; }
        public int SoldApartments { get; set; }
        public int NewApartmentsLast7Days { get; set; }

        public int OpenSupportTickets { get; set; }
    }
}
