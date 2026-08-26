using Microsoft.AspNetCore.Http;

namespace serverApi.Models.DTOs
{
    public class UploadImageDto
    {
        public Guid ApartmentId { get; set; }
        public IFormFile Image { get; set; } = null!;
    }
}