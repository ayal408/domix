using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace serverApi.Models.DTOs
{
    public class ApartmentDTO
    {
        public Guid ApartmentId { get; set; }
        public Guid UserId { get; set; }
        public bool status { get; set; }
        public decimal price { get; set; }
        public DateTime date { get; set; }
        public string city { get; set; } = string.Empty;
        public string area { get; set; } = string.Empty;
        public string address { get; set; } = string.Empty;
        public string? description { get; set; }
        public int? SquareMeters { get; set; }
        public int? SumOfRooms { get; set; }
        public int? SumOfBeds { get; set; }
        public int? floor { get; set; }
        public bool? elevator { get; set; }
        public bool? Parking { get; set; }
        public string? PropertyType { get; set; }
        public DateTime dateInsert { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        /// <summary>Running average, 0-5. 0 with <see cref="RatingCount"/> 0 means unrated.</summary>
        public int Rating { get; set; }
        public int RatingCount { get; set; }
        public List<ApartmentImageDTO>? ApartmentImages { get; set; }
    }

    /// <summary>Body for <c>POST /api/Apartment/{id}/rate</c>.</summary>
    public class RateApartmentDTO
    {
        [Range(1, 5)]
        public int Score { get; set; }
    }

    public class CreateApartmentDTO
    {
        public string city { get; set; } = string.Empty;
        public string address { get; set; } = string.Empty;
        public string? area { get; set; }
        public decimal price { get; set; }
        public string? description { get; set; }
        public int? SquareMeters { get; set; }
        public int? SumOfRooms { get; set; }
        public int? SumOfBeds { get; set; }
        public int? floor { get; set; }
        public bool? elevator { get; set; }
        public bool? Parking { get; set; }
        public string? PropertyType { get; set; }
    }

    public class UpdateApartmentDTO
    {
        public string city { get; set; } = string.Empty;
        public string address { get; set; } = string.Empty;
        public string? area { get; set; }
        public decimal price { get; set; }
        public string? description { get; set; }
        public int? SquareMeters { get; set; }
        public int? SumOfRooms { get; set; }
        public int? SumOfBeds { get; set; }
        public int? floor { get; set; }
        public bool? elevator { get; set; }
        public bool? Parking { get; set; }
        public string? PropertyType { get; set; }
        /// <summary>Whether the listing is live. Omit to leave unchanged.</summary>
        public bool? status { get; set; }
    }
}
