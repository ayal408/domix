using System;

namespace serverApi.Models.DTOs
{
    public class ApartmentImageDTO
    {
        public Guid ImageId { get; set; }
        public Guid ApartmentId { get; set; }
        public string ImageUrl { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}