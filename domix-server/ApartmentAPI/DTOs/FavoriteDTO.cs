namespace serverApi.Models.DTOs
{
    /// <summary>A favorited listing, projected with the apartment so the client doesn't need a second round-trip.</summary>
    public class FavoriteDTO
    {
        public Guid FavoriteId { get; set; }
        public Guid ApartmentId { get; set; }
        public DateTime CreatedAt { get; set; }
        public ApartmentDTO? Apartment { get; set; }
    }
}
