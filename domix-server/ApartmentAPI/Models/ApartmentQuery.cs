namespace serverApi.Models
{
    public class ApartmentQuery
    {
        public string? City { get; set; }
        public int? MinPrice { get; set; }
        public int? MaxPrice { get; set; }
        public int Skip { get; set; } = 0;
        public int Take { get; set; } = 20;
        public string OrderBy { get; set; } = "dateInsert";
        public bool Desc { get; set; } = true;
    }
}