using System.ComponentModel.DataAnnotations;

namespace serverApi.Models
{
    public class ApartmentImage
    {
        [Key]
        public Guid ImageId { get; set; }
        public Guid ApartmentId { get; set; }
        public string ImageUrl { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }

        public Apartment Apartment { get; set; } = null!;
    }
}