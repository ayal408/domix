using Microsoft.AspNetCore.Http;
using serverApi.Models.DTOs;

namespace serverApi.Services.Interfaces
{
    public interface IApartmentImageService
    {
        Task<IEnumerable<ApartmentImageDTO>> GetAllImagesAsync(CancellationToken cancellationToken = default);
        Task<ApartmentImageDTO> CreateImageAsync(ApartmentImageDTO dto, CancellationToken cancellationToken = default);
        Task<ApartmentImageDTO> UploadImageAsync(UploadImageDto dto, CancellationToken cancellationToken = default);
    }
}