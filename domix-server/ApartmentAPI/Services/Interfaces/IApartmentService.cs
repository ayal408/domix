using serverApi.Models.DTOs;

namespace serverApi.Services.Interfaces
{
    public interface IApartmentService
    {
        Task<IEnumerable<ApartmentDTO>> GetAllApartmentsAsync(CancellationToken cancellationToken = default);
        Task<IEnumerable<string>> GetCitiesAsync(CancellationToken cancellationToken = default);
        Task<IEnumerable<ApartmentDTO>> SearchApartmentsAsync(
            string? city,
            string? area,
            int? minPrice,
            int? maxPrice,
            int? minRooms,
            int? maxRooms,
            string? propertyType,
            bool? parking,
            bool? elevator,
            string? sortBy,
            CancellationToken cancellationToken = default);
        Task<ApartmentDTO> CreateApartmentAsync(CreateApartmentDTO dto, Guid userId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Updates an existing apartment. Returns null when no apartment with the given id exists.
        /// Throws <see cref="UnauthorizedAccessException"/> when the caller neither owns the listing
        /// nor passes <paramref name="isPrivileged"/> (Admin/Manager).
        /// </summary>
        Task<ApartmentDTO?> UpdateApartmentAsync(Guid apartmentId, UpdateApartmentDTO dto, Guid userId, bool isPrivileged, CancellationToken cancellationToken = default);

        /// <summary>
        /// Deletes an apartment. Returns null when no apartment with the given id exists, true on success.
        /// Throws <see cref="UnauthorizedAccessException"/> when the caller neither owns the listing
        /// nor passes <paramref name="isPrivileged"/> (Admin/Manager).
        /// </summary>
        Task<bool?> DeleteApartmentAsync(Guid apartmentId, Guid userId, bool isPrivileged, CancellationToken cancellationToken = default);

        /// <summary>
        /// Folds a 1-5 score into the listing's running average rating. Returns null when no
        /// apartment with the given id exists. Throws <see cref="UnauthorizedAccessException"/>
        /// when the caller owns the listing — an owner cannot rate their own apartment.
        /// </summary>
        Task<ApartmentDTO?> RateApartmentAsync(Guid apartmentId, Guid userId, int score, CancellationToken cancellationToken = default);
    }
}