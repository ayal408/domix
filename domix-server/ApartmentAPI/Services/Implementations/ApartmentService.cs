using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    public class ApartmentService : IApartmentService
    {
        private readonly ApartmentContext _context;
        private readonly IGeocodingService _geocodingService;
        private readonly ILogger<ApartmentService> _logger;
        private readonly IHttpContextAccessor? _http;

        public ApartmentService(ApartmentContext context, IGeocodingService geocodingService, ILogger<ApartmentService> logger, IHttpContextAccessor? http = null)
        {
            _context = context;
            _geocodingService = geocodingService;
            _logger = logger;
            _http = http;
        }

        public async Task<IEnumerable<ApartmentDTO>> GetAllApartmentsAsync(CancellationToken cancellationToken = default, int offset = 0, int pageSize = 100)
        {
            var apartments = await _context.Apartments
                .Include(a => a.ApartmentImages)
                .AsNoTracking()
                .OrderByDescending(a => a.dateInsert).ThenBy(a => a.ApartmentId)
                .Skip(Math.Max(0, offset)).Take(Math.Clamp(pageSize, 1, 100))
                .ToListAsync(cancellationToken);

            return apartments.Select(Map);
        }

        public async Task<ApartmentDTO?> GetApartmentByIdAsync(Guid apartmentId, CancellationToken cancellationToken = default)
        {
            var apartment = await _context.Apartments
                .Include(a => a.ApartmentImages)
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.ApartmentId == apartmentId, cancellationToken);

            return apartment == null ? null : Map(apartment);
        }

        public async Task<IEnumerable<string>> GetAreasAsync(string? city, CancellationToken cancellationToken = default)
        {
            var query = _context.Apartments.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(city)) query = query.Where(a => a.city == city.Trim());
            return await query.Where(a => a.area != null && a.area.Trim() != "")
                .Select(a => a.area.Trim()).Distinct().OrderBy(area => area).ToListAsync(cancellationToken);
        }

        public async Task<IEnumerable<string>> GetCitiesAsync(CancellationToken cancellationToken = default)
        {
            return await _context.Apartments
                .Select(a => a.city)
                .Distinct()
                .OrderBy(c => c)
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }

        public async Task<IEnumerable<ApartmentDTO>> SearchApartmentsAsync(
            string? city,
            string? area,
            int? minPrice,
            int? maxPrice,
            decimal? minRooms,
            decimal? maxRooms,
            string? propertyType,
            bool? parking,
            bool? elevator,
            string? sortBy,
            CancellationToken cancellationToken = default, string? listingType = null, int offset = 0, int pageSize = 100, Guid? ownerId = null)
        {
            var query = ApplySearchFilters(
                _context.Apartments.Include(a => a.ApartmentImages).AsNoTracking().AsQueryable(),
                city, area, minPrice, maxPrice, minRooms, maxRooms, propertyType, parking, elevator, listingType);

            if (ownerId.HasValue)
            {
                var viewer = _http?.HttpContext?.User;
                var own = viewer?.FindFirst("userId")?.Value == ownerId.Value.ToString() ||
                    viewer?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value == ownerId.Value.ToString();
                var privileged = viewer?.IsInRole("Admin") == true || viewer?.IsInRole("Manager") == true;
                query = query.Where(a => a.UserId == ownerId.Value && (!a.IsAnonymous || own || privileged));
            }

            var ordered = sortBy switch
            {
                "price_asc" => query.OrderBy(a => a.price),
                "price_desc" => query.OrderByDescending(a => a.price),
                "rating" => query.OrderByDescending(a => a.RecordedRatingCount > 0 ? (decimal)a.RatingSum / a.RecordedRatingCount : a.Rating).ThenByDescending(a => a.RecordedRatingCount > 0 ? a.RecordedRatingCount : a.RatingCount),
                _ => query.OrderByDescending(a => a.dateInsert),
            };

            var result = await ordered.ThenBy(a => a.ApartmentId)
                .Skip(Math.Max(0, offset)).Take(Math.Clamp(pageSize, 1, 100)).ToListAsync(cancellationToken);
            return result.Select(Map);
        }

        /// <summary>Shared by <see cref="SearchApartmentsAsync"/> and saved-search matching so the two never drift apart.</summary>
        internal static IQueryable<Apartment> ApplySearchFilters(
            IQueryable<Apartment> query,
            string? city,
            string? area,
            int? minPrice,
            int? maxPrice,
            decimal? minRooms,
            decimal? maxRooms,
            string? propertyType,
            bool? parking,
            bool? elevator, string? listingType = null)
        {
            // Rented/Sold listings are "removed from the pool" without being deleted:
            // they never surface through search or saved-search alert matching.
            query = query.Where(a => (a.Status == ApartmentStatus.Available || a.Status == ApartmentStatus.Negotiating));

            if (!string.IsNullOrWhiteSpace(listingType))
                query = query.Where(a => a.ListingType == listingType);

            if (!string.IsNullOrWhiteSpace(city))
                query = query.Where(a => a.city.Contains(city));

            if (!string.IsNullOrWhiteSpace(area))
                query = query.Where(a => a.area.Contains(area));

            if (minPrice.HasValue)
                query = query.Where(a => a.price >= minPrice.Value);

            if (maxPrice.HasValue)
                query = query.Where(a => a.price <= maxPrice.Value);

            if (minRooms.HasValue)
                query = query.Where(a => a.SumOfRooms >= minRooms.Value);

            if (maxRooms.HasValue)
                query = query.Where(a => a.SumOfRooms <= maxRooms.Value);

            if (!string.IsNullOrWhiteSpace(propertyType))
                query = query.Where(a => a.PropertyType == propertyType);

            if (parking.HasValue)
                query = query.Where(a => a.Parking == parking.Value);

            if (elevator.HasValue)
                query = query.Where(a => a.elevator == elevator.Value);

            return query;
        }

        public async Task<ApartmentDTO> CreateApartmentAsync(CreateApartmentDTO dto, Guid userId, CancellationToken cancellationToken = default)
        {
            var (lat, lng) = await _geocodingService.GetCoordinatesAsync(dto.city, dto.address, cancellationToken);

            var apartment = new Apartment
            {
                ApartmentId = Guid.NewGuid(),
                UserId = userId,
                city = dto.city.Trim(),
                NormalizedCity = dto.city.Trim().ToLowerInvariant(),
                address = dto.address.Trim(),
                area = dto.area?.Trim() ?? string.Empty,
                price = dto.price,
                description = dto.description?.Trim() ?? string.Empty,
                SquareMeters = dto.SquareMeters,
                SumOfRooms = dto.SumOfRooms,
                SumOfBeds = dto.SumOfBeds,
                floor = dto.floor,
                elevator = dto.elevator,
                Parking = dto.Parking,
                PropertyType = dto.PropertyType,
                ListingType = dto.ListingType,
                AvailableFrom = dto.ListingType == "Exchange" ? dto.AvailableFrom : null,
                AvailableTo = dto.ListingType == "Exchange" ? dto.AvailableTo : null,
                DesiredCity = dto.ListingType == "Exchange" ? dto.DesiredCity?.Trim() : null,
                dateInsert = DateTime.UtcNow,
                date = DateTime.UtcNow,
                Status = ApartmentStatus.Available,
                IsAnonymous = dto.IsAnonymous,
                Latitude = lat,
                Longitude = lng
            };

            _context.Apartments.Add(apartment);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Successfully created apartment {ApartmentId} for user {UserId}", apartment.ApartmentId, userId);

            return Map(apartment);
        }

        public async Task<ApartmentDTO?> UpdateApartmentAsync(Guid apartmentId, UpdateApartmentDTO dto, Guid userId, bool isPrivileged, CancellationToken cancellationToken = default)
        {
            var apartment = await _context.Apartments
                .Include(a => a.ApartmentImages)
                .FirstOrDefaultAsync(a => a.ApartmentId == apartmentId, cancellationToken);

            if (apartment == null)
                return null;

            if (apartment.UserId != userId && !isPrivileged)
            {
                _logger.LogWarning("User {UserId} attempted to update apartment {ApartmentId} owned by {OwnerId}", userId, apartmentId, apartment.UserId);
                throw new UnauthorizedAccessException("You do not own this apartment.");
            }

            var city = dto.city.Trim();
            var address = dto.address.Trim();
            var locationChanged = !string.Equals(apartment.city, city, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(apartment.address, address, StringComparison.OrdinalIgnoreCase);

            apartment.city = city;
            apartment.NormalizedCity = city.ToLowerInvariant();
            apartment.address = address;
            apartment.area = dto.area?.Trim() ?? string.Empty;
            apartment.price = dto.price;
            apartment.description = dto.description?.Trim() ?? string.Empty;
            apartment.SquareMeters = dto.SquareMeters;
            apartment.SumOfRooms = dto.SumOfRooms;
            apartment.SumOfBeds = dto.SumOfBeds;
            apartment.floor = dto.floor;
            apartment.elevator = dto.elevator;
            apartment.Parking = dto.Parking;
            apartment.PropertyType = dto.PropertyType;
            apartment.ListingType = dto.ListingType;
            apartment.AvailableFrom = dto.ListingType == "Exchange" ? dto.AvailableFrom : null;
            apartment.AvailableTo = dto.ListingType == "Exchange" ? dto.AvailableTo : null;
            apartment.DesiredCity = dto.ListingType == "Exchange" ? dto.DesiredCity?.Trim() : null;
            if (dto.IsAnonymous.HasValue)
                apartment.IsAnonymous = dto.IsAnonymous.Value;

            if (locationChanged)
            {
                var (lat, lng) = await _geocodingService.GetCoordinatesAsync(apartment.city, apartment.address, cancellationToken);
                apartment.Latitude = lat;
                apartment.Longitude = lng;
            }

            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Successfully updated apartment {ApartmentId} for user {UserId}", apartment.ApartmentId, userId);

            return Map(apartment);
        }

        public async Task<bool?> DeleteApartmentAsync(Guid apartmentId, Guid userId, bool isPrivileged, CancellationToken cancellationToken = default)
        {
            var apartment = await _context.Apartments
                .FirstOrDefaultAsync(a => a.ApartmentId == apartmentId, cancellationToken);

            if (apartment == null)
                return null;

            if (apartment.UserId != userId && !isPrivileged)
            {
                _logger.LogWarning("User {UserId} attempted to delete apartment {ApartmentId} owned by {OwnerId}", userId, apartmentId, apartment.UserId);
                throw new UnauthorizedAccessException("You do not own this apartment.");
            }

            apartment.IsDeleted = true;
            apartment.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Successfully deleted apartment {ApartmentId} by user {UserId}", apartmentId, userId);

            return true;
        }

        public async Task<ApartmentDTO?> RateApartmentAsync(Guid apartmentId, Guid userId, int score, CancellationToken cancellationToken = default)
        {
            if (score < 1 || score > 5) throw new ArgumentOutOfRangeException(nameof(score));
            ApartmentDTO? result = null;
            await _context.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                _context.ChangeTracker.Clear();
                await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
                // A no-op UPDATE acquires a row write lock on PostgreSQL (also supported by relational tests).
                var locked = await _context.Apartments.Where(a => a.ApartmentId == apartmentId)
                    .ExecuteUpdateAsync(s => s.SetProperty(a => a.RatingSum, a => a.RatingSum), cancellationToken);
                if (locked == 0) return;
                var apartment = await _context.Apartments.FirstAsync(a => a.ApartmentId == apartmentId, cancellationToken);
                if (apartment.UserId == userId) throw new UnauthorizedAccessException("You cannot rate your own apartment.");
                var rating = await _context.ApartmentRatings.SingleOrDefaultAsync(r => r.ApartmentId == apartmentId && r.UserId == userId, cancellationToken);
                if (rating is null)
                {
                    _context.ApartmentRatings.Add(new ApartmentRating { ApartmentId = apartmentId, UserId = userId, Score = score });
                    apartment.RatingSum += score;
                    apartment.RecordedRatingCount++;
                }
                else
                {
                    apartment.RatingSum += score - rating.Score;
                    rating.Score = score;
                    rating.UpdatedAt = DateTime.UtcNow;
                }
                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                result = Map(apartment);
            });
            return result;
        }

        public async Task<ApartmentDTO?> SetApartmentStatusAsync(Guid apartmentId, ApartmentStatus status, Guid userId, bool isPrivileged, CancellationToken cancellationToken = default)
        {
            var apartment = await _context.Apartments
                .Include(a => a.ApartmentImages)
                .FirstOrDefaultAsync(a => a.ApartmentId == apartmentId, cancellationToken);

            if (apartment == null)
                return null;

            if (apartment.UserId != userId && !isPrivileged)
            {
                _logger.LogWarning("User {UserId} attempted to change status of apartment {ApartmentId} owned by {OwnerId}", userId, apartmentId, apartment.UserId);
                throw new UnauthorizedAccessException("You do not own this apartment.");
            }

            apartment.Status = status;
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Apartment {ApartmentId} status set to {Status} by user {UserId}", apartmentId, status, userId);

            return Map(apartment);
        }

        private ApartmentDTO Map(Apartment a)
        {
            var user = _http?.HttpContext?.User;
            var id = user?.FindFirst("userId")?.Value ?? user?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return ToDTO(a, id == a.UserId.ToString() || user?.IsInRole("Admin") == true || user?.IsInRole("Manager") == true);
        }

        internal static ApartmentDTO ToDTO(Apartment a) => ToDTO(a, false);

        internal static ApartmentDTO ToDTO(Apartment a, bool includePrivate) => new ApartmentDTO
        {
            ApartmentId = a.ApartmentId,
            UserId = a.IsAnonymous && !includePrivate ? Guid.Empty : a.UserId,
            Status = a.Status,
            IsAnonymous = a.IsAnonymous,
            price = a.price,
            date = a.date,
            city = a.city,
            area = a.area,
            address = a.IsAnonymous && !includePrivate ? a.area : a.address,
            description = a.description,
            SquareMeters = a.SquareMeters,
            SumOfRooms = a.SumOfRooms,
            SumOfBeds = a.SumOfBeds,
            floor = a.floor,
            elevator = a.elevator,
            Parking = a.Parking,
            PropertyType = a.PropertyType,
            ListingType = a.ListingType,
            AvailableFrom = a.AvailableFrom,
            AvailableTo = a.AvailableTo,
            DesiredCity = a.DesiredCity,
            dateInsert = a.dateInsert,
            Latitude = a.IsAnonymous && !includePrivate ? null : a.Latitude,
            Longitude = a.IsAnonymous && !includePrivate ? null : a.Longitude,
            Rating = a.CurrentRating,
            RatingCount = a.RecordedRatingCount > 0 ? a.RecordedRatingCount : a.RatingCount,
            LegacyRating = a.Rating,
            LegacyRatingCount = a.RatingCount,
            RatingIsLegacy = a.RecordedRatingCount == 0 && a.RatingCount > 0,
            ApartmentImages = a.ApartmentImages?
                .Where(i => PrivacyImages.LocalPath(i.ImageUrl) != null)
                .Select(i => new ApartmentImageDTO
                {
                    ImageId = i.ImageId,
                    ApartmentId = i.ApartmentId,
                    ImageUrl = i.ImageUrl + "?v=privacy1",
                    CreatedAt = i.CreatedAt
                }).ToList()
        };
    }
}