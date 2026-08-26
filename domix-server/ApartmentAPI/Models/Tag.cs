namespace serverApi.Models
{
    public class Tag
    {
        public Guid TagId { get; set; }
        public string Name { get; set; } = string.Empty;

        public List<Apartment> Apartments { get; set; } = new();
    }
}