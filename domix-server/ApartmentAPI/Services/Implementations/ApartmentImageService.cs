using System.Diagnostics.CodeAnalysis;
using Microsoft.AspNetCore.Http;
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
        private const long MaxImageSizeBytes = 10 * 1024 * 1024; // 10 MB

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

        public async Task<ApartmentImageDTO> CreateImageAsync(ApartmentImageDTO dto, Guid userId, bool isPrivileged, CancellationToken cancellationToken = default)
        {
            var apartment = await _context.Apartments
                .FirstOrDefaultAsync(a => a.ApartmentId == dto.ApartmentId, cancellationToken);

            if (apartment == null)
                throw new KeyNotFoundException("Apartment not found");

            if (apartment.UserId != userId && !isPrivileged)
            {
                _logger.LogWarning("User {UserId} attempted to add an image to apartment {ApartmentId} owned by {OwnerId}", userId, dto.ApartmentId, apartment.UserId);
                throw new UnauthorizedAccessException("You do not own this apartment.");
            }

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

        public async Task<ApartmentImageDTO> UploadImageAsync(UploadImageDto dto, Guid userId, bool isPrivileged, CancellationToken cancellationToken = default)
        {
            if (dto.Image == null || dto.Image.Length == 0)
                raiseInvalidOperation("No image provided");

            if (dto.Image.Length > MaxImageSizeBytes)
                throw new ArgumentException($"Image exceeds the maximum allowed size of {MaxImageSizeBytes / (1024 * 1024)} MB.");

            var extension = Path.GetExtension(dto.Image.FileName).ToLowerInvariant();
            if (!_allowedExtensions.Contains(extension))
                throw new ArgumentException("Invalid file type. Only JPG, PNG, and WEBP are allowed.");

            if (!await HasAllowedImageSignatureAsync(dto.Image, cancellationToken))
                throw new ArgumentException("The file's contents don't match a JPG, PNG, or WEBP image.");

            var apartment = await _context.Apartments
                .FirstOrDefaultAsync(a => a.ApartmentId == dto.ApartmentId, cancellationToken);

            if (apartment == null)
                throw new KeyNotFoundException("Apartment not found");

            if (apartment.UserId != userId && !isPrivileged)
            {
                _logger.LogWarning("User {UserId} attempted to upload an image to apartment {ApartmentId} owned by {OwnerId}", userId, dto.ApartmentId, apartment.UserId);
                throw new UnauthorizedAccessException("You do not own this apartment.");
            }

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

        [DoesNotReturn]
        private static void raiseInvalidOperation(string message) => throw new InvalidOperationException(message);

        /// <summary>
        /// Checks the file's actual bytes against the magic numbers of the three formats we claim
        /// to accept -- the extension check above only looks at the filename, which an attacker
        /// fully controls (e.g. an uploaded .html/.svg/script renamed to photo.jpg).
        /// </summary>
        private static async Task<bool> HasAllowedImageSignatureAsync(IFormFile file, CancellationToken cancellationToken)
        {
            await using var stream = file.OpenReadStream();
            var header = new byte[12];
            var read = await stream.ReadAsync(header.AsMemory(0, header.Length), cancellationToken);
            stream.Seek(0, SeekOrigin.Begin);

            if (read < 3)
                return false;

            // JPEG: FF D8 FF
            if (header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
                return true;

            // PNG: 89 50 4E 47 0D 0A 1A 0A
            if (read >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47
                && header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A)
                return true;

            // WEBP: "RIFF" .... "WEBP"
            if (read >= 12 && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
                && header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P')
                return true;

            return false;
        }
    }
}