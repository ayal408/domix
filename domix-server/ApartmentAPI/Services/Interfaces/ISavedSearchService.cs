using serverApi.Models;
using serverApi.Models.DTOs;

namespace serverApi.Services.Interfaces
{
    public interface ISavedSearchService
    {
        Task<IEnumerable<SavedSearchDTO>> GetForUserAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<SavedSearchDTO> CreateAsync(Guid userId, CreateSavedSearchDTO dto, CancellationToken cancellationToken = default);

        /// <summary>Returns false when no saved search with the given id exists for this user.</summary>
        Task<bool> DeleteAsync(Guid userId, Guid savedSearchId, CancellationToken cancellationToken = default);

        /// <summary>Every saved search across all users — used by the alert background service.</summary>
        Task<List<SavedSearch>> GetAllAsync(CancellationToken cancellationToken = default);

        Task<List<ApartmentDTO>> FindNewMatchesAsync(SavedSearch savedSearch, CancellationToken cancellationToken = default);
        Task MarkNotifiedAsync(Guid savedSearchId, DateTime notifiedAt, CancellationToken cancellationToken = default);
    }
}
