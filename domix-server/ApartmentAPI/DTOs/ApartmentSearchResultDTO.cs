using System;

namespace serverApi.Models.DTOs
{
    public class ApartmentSearchResultDTO
    {
        public Guid ApartmentId { get; set; }
        public string City { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int Bedrooms { get; set; }
        public string ImageUrl { get; set; } = string.Empty;
        public int MatchScore { get; set; }
    }
}