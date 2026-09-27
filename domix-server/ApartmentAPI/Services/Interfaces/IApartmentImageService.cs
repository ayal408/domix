using Microsoft.AspNetCore.Http;
using serverApi.Models.DTOs;

namespace serverApi.Services.Interfaces
{
    public interface IApartmentImageService
    {
        Task<IEnumerable<ApartmentImageDTO>> GetAllImagesAsync(CancellationToken cancellationToken = default);
        Task<ApartmentImageDTO> CreateImageAsync(ApartmentImageDTO dto, Guid userId, bool isPrivileged, CancellationToken cancellationToken = default);
        Task<ApartmentImageDTO> UploadImageAsync(UploadImageDto dto, Guid userId, bool isPrivileged, CancellationToken cancellationToken = default);
    }
}