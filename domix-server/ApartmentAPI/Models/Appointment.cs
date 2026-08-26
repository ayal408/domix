using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace serverApi.Models
{
    public class Appointment
    {
        [Key]
        public Guid AppointmentId { get; set; }

        [Required]
        public Guid ApartmentId { get; set; }

        [Required]
        public Guid UserId { get; set; }

        [Required]
        public DateTime AppointmentDate { get; set; }

        [Required]
        public bool Status { get; set; } 

        [ForeignKey(nameof(ApartmentId))]
        public virtual Apartment Apartment { get; set; } = null!;

        [ForeignKey(nameof(UserId))]
        public virtual User User { get; set; } = null!;
    }
}