using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using serverApi.Data;
using serverApi.Models;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    public class ImageService : IImageService
    {
        private readonly ApartmentContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<ImageService> _logger;
        private readonly string[] _allowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };

        public ImageService(ApartmentContext context, IWebHostEnvironment env, ILogger<ImageService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _env = env ?? throw new ArgumentNullException(nameof(env));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<string> UploadImageAsync(IFormFile file, Guid apartmentId, CancellationToken cancellationToken = default)
        {
            if (file == null || file.Length == 0)
            {
                throw new ArgumentException("No image file provided.", nameof(file));
            }

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!_allowedExtensions.Contains(extension))
            {
                throw new ArgumentException("Invalid file type. Only JPG, PNG, and WEBP are allowed.");
            }

            var webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var folder = Path.Combine(webRootPath, "images", "apartments");

            if (!Directory.Exists(folder))
            {
                Directory.CreateDirectory(folder);
            }

            var fileName = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(folder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream, cancellationToken);
            }

            var imageUrl = $"/images/apartments/{fileName}";

            var image = new ApartmentImage
            {
                ImageId = Guid.NewGuid(),
                ApartmentId = apartmentId,
                ImageUrl = imageUrl,
                CreatedAt = DateTime.UtcNow
            };

            _context.ApartmentImages.Add(image);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Successfully uploaded image {ImageId} for apartment {ApartmentId}", image.ImageId, apartmentId);

            return imageUrl;
        }
    }
}