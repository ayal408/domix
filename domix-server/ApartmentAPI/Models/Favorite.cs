using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace serverApi.Models
{
    public class Favorite
    {
        [Key]
        public Guid FavoriteId { get; set; }

        [Required]
        public Guid UserId { get; set; }

        [Required]
        public Guid ApartmentId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(UserId))]
        public virtual User User { get; set; } = null!;

        [ForeignKey(nameof(ApartmentId))]
        public virtual Apartment Apartment { get; set; } = null!;
    }
}
