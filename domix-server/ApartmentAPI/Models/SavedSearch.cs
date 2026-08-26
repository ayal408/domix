using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace serverApi.Models
{
    public class SavedSearch
    {
        [Key]
        public Guid SavedSearchId { get; set; }

        [Required]
        public Guid UserId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string? City { get; set; }
        public string? Area { get; set; }
        public int? MinPrice { get; set; }
        public int? MaxPrice { get; set; }
        public int? MinRooms { get; set; }
        public int? MaxRooms { get; set; }
        public string? PropertyType { get; set; }
        public bool? Parking { get; set; }
        public bool? Elevator { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// High-water mark for alerting — only apartments inserted after this are
        /// considered "new" matches. Seeded to <see cref="CreatedAt"/> so a fresh
        /// saved search never floods the owner with the entire existing backlog.
        /// </summary>
        public DateTime LastNotifiedAt { get; set; }

        [ForeignKey(nameof(UserId))]
        public virtual User User { get; set; } = null!;
    }
}
