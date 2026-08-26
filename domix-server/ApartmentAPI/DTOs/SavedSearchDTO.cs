namespace serverApi.Models.DTOs
{
    public class SavedSearchDTO
    {
        public Guid SavedSearchId { get; set; }
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
        public DateTime CreatedAt { get; set; }
    }

    public class CreateSavedSearchDTO
    {
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
    }
}
