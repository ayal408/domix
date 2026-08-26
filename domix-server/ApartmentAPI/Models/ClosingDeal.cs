using System.ComponentModel.DataAnnotations;

namespace serverApi.Models
{
    public class ClosingDeal
    {
        [Key]
        public Guid ClosingDealId { get; set; }
        public Guid ApartmentId { get; set; }
        public Guid idUserManager { get; set; }
        public Guid idUserBuyer { get; set; }

        public DateTime dealCloseingDate { get; set; }
        public DateTime startDate { get; set; }
        public DateTime endDate { get; set; }
        public Apartment apartment { get; set; } = null!;
    }
}