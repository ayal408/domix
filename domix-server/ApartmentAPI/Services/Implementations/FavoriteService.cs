using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    public class FavoriteService : IFavoriteService
    {
        private readonly ApartmentContext _context;
        private readonly ILogger<FavoriteService> _logger;

        public FavoriteService(ApartmentContext context, ILogger<FavoriteService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<IEnumerable<FavoriteDTO>> GetFavoritesAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var favorites = await _context.Favorites
                .AsNoTracking()
                .Where(f => f.UserId == userId)
                .Include(f => f.Apartment)
                    .ThenInclude(a => a.ApartmentImages)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync(cancellationToken);

            return favorites.Select(f => new FavoriteDTO
            {
                FavoriteId = f.FavoriteId,
                ApartmentId = f.ApartmentId,
                CreatedAt = f.CreatedAt,
                Apartment = ApartmentService.ToDTO(f.Apartment),
            });
        }

        public async Task<FavoriteDTO?> AddFavoriteAsync(Guid userId, Guid apartmentId, CancellationToken cancellationToken = default)
        {
            var apartmentExists = await _context.Apartments.AnyAsync(a => a.ApartmentId == apartmentId, cancellationToken);
            if (!apartmentExists)
                return null;

            var existing = await _context.Favorites
                .FirstOrDefaultAsync(f => f.UserId == userId && f.ApartmentId == apartmentId, cancellationToken);

            if (existing != null)
                return new FavoriteDTO { FavoriteId = existing.FavoriteId, ApartmentId = existing.ApartmentId, CreatedAt = existing.CreatedAt };

            var favorite = new Favorite
            {
                FavoriteId = Guid.NewGuid(),
                UserId = userId,
                ApartmentId = apartmentId,
                CreatedAt = DateTime.UtcNow,
            };

            _context.Favorites.Add(favorite);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("User {UserId} favorited apartment {ApartmentId}", userId, apartmentId);

            return new FavoriteDTO { FavoriteId = favorite.FavoriteId, ApartmentId = favorite.ApartmentId, CreatedAt = favorite.CreatedAt };
        }

        public async Task<bool> RemoveFavoriteAsync(Guid userId, Guid apartmentId, CancellationToken cancellationToken = default)
        {
            var favorite = await _context.Favorites
                .FirstOrDefaultAsync(f => f.UserId == userId && f.ApartmentId == apartmentId, cancellationToken);

            if (favorite == null)
                return false;

            _context.Favorites.Remove(favorite);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("User {UserId} unfavorited apartment {ApartmentId}", userId, apartmentId);

            return true;
        }
    }
}
