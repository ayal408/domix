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

        public ApartmentService(ApartmentContext context, IGeocodingService geocodingService, ILogger<ApartmentService> logger)
        {
            _context = context;
            _geocodingService = geocodingService;
            _logger = logger;
        }

        public async Task<IEnumerable<ApartmentDTO>> GetAllApartmentsAsync(CancellationToken cancellationToken = default)
        {
            var apartments = await _context.Apartments
                .Include(a => a.ApartmentImages)
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            return apartments.Select(ToDTO);
        }

        public async Task<ApartmentDTO?> GetApartmentByIdAsync(Guid apartmentId, CancellationToken cancellationToken = default)
        {
            var apartment = await _context.Apartments
                .Include(a => a.ApartmentImages)
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.ApartmentId == apartmentId, cancellationToken);

            return apartment == null ? null : ToDTO(apartment);
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
            CancellationToken cancellationToken = default, string? listingType = null)
        {
            var query = ApplySearchFilters(
                _context.Apartments.Include(a => a.ApartmentImages).AsNoTracking().AsQueryable(),
                city, area, minPrice, maxPrice, minRooms, maxRooms, propertyType, parking, elevator, listingType);

            query = sortBy switch
            {
                "price_asc" => query.OrderBy(a => a.price),
                "price_desc" => query.OrderByDescending(a => a.price),
                "rating" => query.OrderByDescending(a => a.Rating).ThenByDescending(a => a.RatingCount),
                _ => query.OrderByDescending(a => a.dateInsert),
            };

            var result = await query.ToListAsync(cancellationToken);
            return result.Select(ToDTO);
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
            query = query.Where(a => a.Status == ApartmentStatus.Available);

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
                address = dto.address.Trim(),
                area = dto.area?.Trim() ?? string.Empty,
                price = (int)dto.price,
                description = dto.description?.Trim() ?? string.Empty,
                SquareMeters = dto.SquareMeters,
                SumOfRooms = dto.SumOfRooms,
                SumOfBeds = dto.SumOfBeds,
                floor = dto.floor,
                elevator = dto.elevator,
                Parking = dto.Parking,
                PropertyType = dto.PropertyType,
                ListingType = dto.ListingType,
                GuestCapacity = dto.GuestCapacity,
                KosherKitchen = dto.KosherKitchen,
                SeparateBeds = dto.SeparateBeds,
                SynagogueDistanceMeters = dto.SynagogueDistanceMeters,
                KitchenNotes = dto.KitchenNotes,
                ShabbatNotes = dto.ShabbatNotes,

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

            return ToDTO(apartment);
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
            apartment.address = address;
            apartment.area = dto.area?.Trim() ?? string.Empty;
            apartment.price = (int)dto.price;
            apartment.description = dto.description?.Trim() ?? string.Empty;
            apartment.SquareMeters = dto.SquareMeters;
            apartment.SumOfRooms = dto.SumOfRooms;
            apartment.SumOfBeds = dto.SumOfBeds;
            apartment.floor = dto.floor;
            apartment.elevator = dto.elevator;
            apartment.Parking = dto.Parking;
            apartment.PropertyType = dto.PropertyType;
            apartment.ListingType = dto.ListingType;
            apartment.GuestCapacity = dto.GuestCapacity;
            apartment.KosherKitchen = dto.KosherKitchen;
            apartment.SeparateBeds = dto.SeparateBeds;
            apartment.SynagogueDistanceMeters = dto.SynagogueDistanceMeters;
            apartment.KitchenNotes = dto.KitchenNotes;
            apartment.ShabbatNotes = dto.ShabbatNotes;

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

            return ToDTO(apartment);
        }

        public async Task<bool?> DeleteApartmentAsync(Guid apartmentId, Guid userId, bool isPrivileged, CancellationToken cancellationToken = default)
        {
            return await _context.Database.CreateExecutionStrategy().ExecuteAsync<bool?>(async () => {
            _context.ChangeTracker.Clear();
            await using var transaction = await new ExchangeWorkflow(_context).LockHomes(new[] { apartmentId }, cancellationToken);
            var apartment = await _context.Apartments
                .FirstOrDefaultAsync(a => a.ApartmentId == apartmentId, cancellationToken);

            if (apartment == null)
                return null;

            if (apartment.UserId != userId && !isPrivileged)
            {
                _logger.LogWarning("User {UserId} attempted to delete apartment {ApartmentId} owned by {OwnerId}", userId, apartmentId, apartment.UserId);
                throw new UnauthorizedAccessException("You do not own this apartment.");
            }

            if (await _context.ExchangeAgreements.AnyAsync(x => x.Status == "Accepted" && x.End > ExchangeMatching.Today &&
                (x.OfferedApartmentId == apartmentId || x.RequestedApartmentId == apartmentId), cancellationToken))
                throw new ExchangeConflict("יש לבטל החלפה מאושרת לפני מחיקת הדירה");
            _context.ExchangeCalendarPeriods.RemoveRange(_context.ExchangeCalendarPeriods.Where(x => x.ApartmentId == apartmentId));
            _context.ExchangeWatches.RemoveRange(_context.ExchangeWatches.Where(x => x.OfferedApartmentId == apartmentId));
            var pending = await _context.ExchangeAgreements.Where(x => x.Status == "Pending" && (x.OfferedApartmentId == apartmentId || x.RequestedApartmentId == apartmentId)).ToListAsync(cancellationToken);
            foreach (var request in pending) { request.Status = "Cancelled"; request.Revision++; request.UpdatedAt = DateTime.UtcNow; }
            _context.Apartments.Remove(apartment);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Successfully deleted apartment {ApartmentId} by user {UserId}", apartmentId, userId);

            if (transaction != null) await transaction.CommitAsync(cancellationToken);
            return true;
            });
        }

        public async Task<ApartmentDTO?> RateApartmentAsync(Guid apartmentId, Guid userId, int score, CancellationToken cancellationToken = default)
        {
            var apartment = await _context.Apartments
                .FirstOrDefaultAsync(a => a.ApartmentId == apartmentId, cancellationToken);

            if (apartment == null)
                return null;

            if (apartment.UserId == userId)
            {
                _logger.LogWarning("User {UserId} attempted to rate their own apartment {ApartmentId}", userId, apartmentId);
                throw new UnauthorizedAccessException("You cannot rate your own apartment.");
            }

            apartment.AddRating(score);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Apartment {ApartmentId} rated {Score} by user {UserId}", apartmentId, score, userId);

            return ToDTO(apartment);
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

            return ToDTO(apartment);
        }

        internal static ApartmentDTO ToDTO(Apartment a) => new ApartmentDTO
        {
            ApartmentId = a.ApartmentId,
            UserId = a.UserId,
            Status = a.Status,
            IsAnonymous = a.IsAnonymous,
            price = a.price,
            date = a.date,
            city = a.city,
            area = a.area,
            address = a.address,
            description = a.description,
            SquareMeters = a.SquareMeters,
            SumOfRooms = a.SumOfRooms,
            SumOfBeds = a.SumOfBeds,
            floor = a.floor,
            elevator = a.elevator,
            Parking = a.Parking,
            PropertyType = a.PropertyType,
            ListingType = a.ListingType,
            GuestCapacity = a.GuestCapacity,
            KosherKitchen = a.KosherKitchen,
            SeparateBeds = a.SeparateBeds,
            SynagogueDistanceMeters = a.SynagogueDistanceMeters,
            KitchenNotes = a.KitchenNotes,
            ShabbatNotes = a.ShabbatNotes,

            AvailableFrom = a.AvailableFrom,
            AvailableTo = a.AvailableTo,
            DesiredCity = a.DesiredCity,
            dateInsert = a.dateInsert,
            Latitude = a.Latitude,
            Longitude = a.Longitude,
            Rating = a.Rating,
            RatingCount = a.RatingCount,
            ApartmentImages = a.ApartmentImages?
                .Select(i => new ApartmentImageDTO
                {
                    ImageId = i.ImageId,
                    ApartmentId = i.ApartmentId,
                    ImageUrl = i.ImageUrl,
                    CreatedAt = i.CreatedAt
                }).ToList()
        };
    }
}