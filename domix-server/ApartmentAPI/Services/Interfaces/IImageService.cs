using Microsoft.AspNetCore.Http;

namespace serverApi.Services.Interfaces
{
    public interface IImageService
    {
        Task<string> UploadImageAsync(IFormFile file, Guid apartmentId, CancellationToken cancellationToken = default);
    }
}