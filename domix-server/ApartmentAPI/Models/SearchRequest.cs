using System.ComponentModel.DataAnnotations;

namespace serverApi.Models
{
    public class SearchRequest
    {
        [Key]
        public Guid SearchId { get; set; }
        public Guid UserId { get; set; }
        public string Location { get; set; } = string.Empty;
        public decimal MinPrice { get; set; }
        public decimal MaxPrice { get; set; }
        public int MinBedrooms { get; set; }
        public int MaxBedrooms { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public User User { get; set; } = null!;
    }

    public class SearchRequestDTO
    {
        public Guid SearchId { get; set; }
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public decimal MinPrice { get; set; }
        public decimal MaxPrice { get; set; }
        public int MinBedrooms { get; set; }
        public int MaxBedrooms { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class SearchRequestCreateDTO
    {
        public Guid UserId { get; set; }
        public string Location { get; set; } = string.Empty;
        public decimal MinPrice { get; set; }
        public decimal MaxPrice { get; set; }
        public int MinBedrooms { get; set; }
        public int MaxBedrooms { get; set; }
    }
}