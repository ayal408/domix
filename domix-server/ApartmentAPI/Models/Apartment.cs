using serverApi.Models.DTOs;
using System.ComponentModel.DataAnnotations;

namespace serverApi.Models
{
    public class Apartment
    {
        public Guid ApartmentId { get; set; }
        public Guid UserId { get; set; }
        public bool status { get; set; }
        public int price { get; set; }
        [Required]
        public string city { get; set; } = string.Empty;
        public DateTime date { get; set; }
        public string area { get; set; } = string.Empty;
        public string address { get; set; } = string.Empty;
        public string description { get; set; } = string.Empty;
        public int? SquareMeters { get; set; }
        public int? SumOfRooms { get; set; }
        public int? SumOfBeds { get; set; }
        public int? floor { get; set; }
        public bool? elevator { get; set; }
        public bool? Parking { get; set; }
        public string? PropertyType { get; set; }
        public int ViewsCount { get; set; } = 0;
        public DateTime dateInsert { get; set; }
        public int Rating { get; set; } = 0;
        public int RatingCount { get; set; } = 0;

        public void AddRating(int score)
        {
            Rating = (Rating * RatingCount + score) / (RatingCount + 1);
            RatingCount++;
        }

        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public User User { get; set; } = null!;
        public List<Appointment> Appointments { get; set; } = new();
        public List<ClosingDeal> ClosingDeal { get; set; } = new();
        public ICollection<ApartmentImage> ApartmentImages { get; set; } = new List<ApartmentImage>();
        public List<Tag> Tags { get; set; } = new();
    }
}