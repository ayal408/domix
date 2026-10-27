using serverApi.Models.DTOs;
using System.ComponentModel.DataAnnotations;

namespace serverApi.Models
{
    public class Apartment
    {
        public Guid? ClientDraftId { get; set; }
        public Guid ApartmentId { get; set; }
        public Guid UserId { get; set; }
        public ApartmentStatus Status { get; set; } = ApartmentStatus.Available;
        public bool IsAnonymous { get; set; } = false;
        public string ListingType { get; set; } = "Unspecified";
        public DateOnly? AvailableFrom { get; set; }
        public DateOnly? AvailableTo { get; set; }
        public string? DesiredCity { get; set; }
        public DateTime? LastConfirmedAt { get; set; }
        public DateTime? RenewalSnoozedUntil { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string NormalizedCity { get; set; } = "";
        public decimal price { get; set; }
        [Required]
        public string city { get; set; } = string.Empty;
        public DateTime date { get; set; }
        public string area { get; set; } = string.Empty;
        public string address { get; set; } = string.Empty;
        public string description { get; set; } = string.Empty;
        public int? SquareMeters { get; set; }
        public decimal? SumOfRooms { get; set; }
        public int? SumOfBeds { get; set; }
        public int? floor { get; set; }
        public bool? elevator { get; set; }
        public bool? Parking { get; set; }
        public string? PropertyType { get; set; }
        public int ViewsCount { get; set; } = 0;
        public DateTime dateInsert { get; set; }
        public int Rating { get; set; } = 0;
        public int RatingCount { get; set; } = 0;

        // Rating/RatingCount are the untouched legacy aggregates; their original votes cannot be reconstructed.
        public long RatingSum { get; set; }
        public int RecordedRatingCount { get; set; }

        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public decimal CurrentRating => RecordedRatingCount > 0 ? (decimal)RatingSum / RecordedRatingCount : Rating;

        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public User User { get; set; } = null!;
        public List<Appointment> Appointments { get; set; } = new();
        public List<ClosingDeal> ClosingDeal { get; set; } = new();
        public ICollection<ApartmentImage> ApartmentImages { get; set; } = new List<ApartmentImage>();
        public List<Tag> Tags { get; set; } = new();
    }
}