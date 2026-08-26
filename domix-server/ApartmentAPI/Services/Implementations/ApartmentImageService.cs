using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    public class ApartmentImageService : IApartmentImageService
    {
        private readonly ApartmentContext _context;
        private readonly ILogger<ApartmentImageService> _logger;
        private readonly string[] _allowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };

        public ApartmentImageService(ApartmentContext context, ILogger<ApartmentImageService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<IEnumerable<ApartmentImageDTO>> GetAllImagesAsync(CancellationToken cancellationToken = default)
        {
            return await _context.ApartmentImages
                .OrderByDescending(i => i.CreatedAt)
                .Select(i => new ApartmentImageDTO
                {
                    ImageId = i.ImageId,
                    ApartmentId = i.ApartmentId,
                    ImageUrl = i.ImageUrl,
                    CreatedAt = i.CreatedAt
                })
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }

        public async Task<ApartmentImageDTO> CreateImageAsync(ApartmentImageDTO dto, CancellationToken cancellationToken = default)
        {
            var exists = await _context.Apartments
                .AnyAsync(a => a.ApartmentId == dto.ApartmentId, cancellationToken);

            if (!exists)
                throw new KeyNotFoundException("Apartment not found");

            var image = new ApartmentImage
            {
                ImageId = Guid.NewGuid(),
                ApartmentId = dto.ApartmentId,
                ImageUrl = dto.ImageUrl,
                CreatedAt = DateTime.UtcNow
            };

            _context.ApartmentImages.Add(image);
            await _context.SaveChangesAsync(cancellationToken);

            return new ApartmentImageDTO
            {
                ImageId = image.ImageId,
                ApartmentId = image.ApartmentId,
                ImageUrl = image.ImageUrl,
                CreatedAt = image.CreatedAt
            };
        }

        public async Task<ApartmentImageDTO> UploadImageAsync(UploadImageDto dto, CancellationToken cancellationToken = default)
        {
            if (dto.Image == null || dto.Image.Length == 0)
                raiseInvalidOperation("No image provided");

            var extension = Path.GetExtension(dto.Image.FileName).ToLowerInvariant();
            if (!_allowedExtensions.Contains(extension))
                throw new ArgumentException("Invalid file type. Only JPG, PNG, and WEBP are allowed.");

            var exists = await _context.Apartments
                .AnyAsync(a => a.ApartmentId == dto.ApartmentId, cancellationToken);

            if (!exists)
                throw new KeyNotFoundException("Apartment not found");

            var fileName = $"{Guid.NewGuid()}{extension}";
            var folderPath = Path.Combine("wwwroot", "images");

            if (!Directory.Exists(folderPath))
                Directory.CreateDirectory(folderPath);

            var fullPath = Path.Combine(folderPath, fileName);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await dto.Image.CopyToAsync(stream, cancellationToken);
            }

            var img = new ApartmentImage
            {
                ImageId = Guid.NewGuid(),
                ApartmentId = dto.ApartmentId,
                ImageUrl = $"/images/{fileName}",
                CreatedAt = DateTime.UtcNow
            };

            _context.ApartmentImages.Add(img);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Successfully uploaded image {ImageId} for apartment {ApartmentId}", img.ImageId, dto.ApartmentId);

            return new ApartmentImageDTO
            {
                ImageId = img.ImageId,
                ApartmentId = img.ApartmentId,
                ImageUrl = img.ImageUrl,
                CreatedAt = img.CreatedAt
            };
        }

        private static void raiseInvalidOperation(string message) => throw new InvalidOperationException(message);
    }
}