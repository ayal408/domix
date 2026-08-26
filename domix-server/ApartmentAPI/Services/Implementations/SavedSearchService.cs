using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    public class SavedSearchService : ISavedSearchService
    {
        private readonly ApartmentContext _context;
        private readonly ILogger<SavedSearchService> _logger;

        public SavedSearchService(ApartmentContext context, ILogger<SavedSearchService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<IEnumerable<SavedSearchDTO>> GetForUserAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var searches = await _context.SavedSearches
                .AsNoTracking()
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync(cancellationToken);

            return searches.Select(ToDTO);
        }

        public async Task<SavedSearchDTO> CreateAsync(Guid userId, CreateSavedSearchDTO dto, CancellationToken cancellationToken = default)
        {
            var now = DateTime.UtcNow;
            var savedSearch = new SavedSearch
            {
                SavedSearchId = Guid.NewGuid(),
                UserId = userId,
                Name = dto.Name.Trim(),
                City = dto.City?.Trim(),
                Area = dto.Area?.Trim(),
                MinPrice = dto.MinPrice,
                MaxPrice = dto.MaxPrice,
                MinRooms = dto.MinRooms,
                MaxRooms = dto.MaxRooms,
                PropertyType = dto.PropertyType,
                Parking = dto.Parking,
                Elevator = dto.Elevator,
                CreatedAt = now,
                LastNotifiedAt = now,
            };

            _context.SavedSearches.Add(savedSearch);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("User {UserId} created saved search {SavedSearchId}", userId, savedSearch.SavedSearchId);

            return ToDTO(savedSearch);
        }

        public async Task<bool> DeleteAsync(Guid userId, Guid savedSearchId, CancellationToken cancellationToken = default)
        {
            var savedSearch = await _context.SavedSearches
                .FirstOrDefaultAsync(s => s.SavedSearchId == savedSearchId && s.UserId == userId, cancellationToken);

            if (savedSearch == null)
                return false;

            _context.SavedSearches.Remove(savedSearch);
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<List<SavedSearch>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            return await _context.SavedSearches.AsNoTracking().ToListAsync(cancellationToken);
        }

        public async Task<List<ApartmentDTO>> FindNewMatchesAsync(SavedSearch savedSearch, CancellationToken cancellationToken = default)
        {
            var query = ApartmentService.ApplySearchFilters(
                _context.Apartments.Include(a => a.ApartmentImages).AsNoTracking().Where(a => a.status),
                savedSearch.City, savedSearch.Area, savedSearch.MinPrice, savedSearch.MaxPrice,
                savedSearch.MinRooms, savedSearch.MaxRooms, savedSearch.PropertyType, savedSearch.Parking, savedSearch.Elevator);

            var matches = await query
                .Where(a => a.dateInsert > savedSearch.LastNotifiedAt)
                .OrderByDescending(a => a.dateInsert)
                .ToListAsync(cancellationToken);

            return matches.Select(ApartmentService.ToDTO).ToList();
        }

        public async Task MarkNotifiedAsync(Guid savedSearchId, DateTime notifiedAt, CancellationToken cancellationToken = default)
        {
            var savedSearch = await _context.SavedSearches
                .FirstOrDefaultAsync(s => s.SavedSearchId == savedSearchId, cancellationToken);

            if (savedSearch == null)
                return;

            savedSearch.LastNotifiedAt = notifiedAt;
            await _context.SaveChangesAsync(cancellationToken);
        }

        private static SavedSearchDTO ToDTO(SavedSearch s) => new SavedSearchDTO
        {
            SavedSearchId = s.SavedSearchId,
            Name = s.Name,
            City = s.City,
            Area = s.Area,
            MinPrice = s.MinPrice,
            MaxPrice = s.MaxPrice,
            MinRooms = s.MinRooms,
            MaxRooms = s.MaxRooms,
            PropertyType = s.PropertyType,
            Parking = s.Parking,
            Elevator = s.Elevator,
            CreatedAt = s.CreatedAt,
        };
    }
}
