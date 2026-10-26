using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;
using System.Security.Claims;
namespace serverApi.Services.Implementations;

public class ImageService(IApartmentImageService images, IHttpContextAccessor http) : IImageService
{
    public async Task<string> UploadImageAsync(IFormFile file, Guid apartmentId, CancellationToken cancellationToken = default)
    {
        var user = http.HttpContext?.User;
        var claim = user?.FindFirst("userId")?.Value ?? user?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (user?.Identity?.IsAuthenticated != true || !Guid.TryParse(claim, out var id)) throw new UnauthorizedAccessException();
        var result = await images.UploadImageAsync(new UploadImageDto { ApartmentId = apartmentId, Image = file }, id,
            user.IsInRole("Admin") || user.IsInRole("Manager"), cancellationToken);
        return result.ImageUrl;
    }
}
