using serverApi.Models.DTOs;

namespace serverApi.Services.Interfaces
{
    public interface IFavoriteService
    {
        Task<IEnumerable<FavoriteDTO>> GetFavoritesAsync(Guid userId, CancellationToken cancellationToken = default);

        /// <summary>Idempotent — adding an already-favorited apartment is a no-op that returns the existing favorite.</summary>
        Task<FavoriteDTO?> AddFavoriteAsync(Guid userId, Guid apartmentId, CancellationToken cancellationToken = default);

        /// <summary>Returns false when the apartment wasn't favorited by this user.</summary>
        Task<bool> RemoveFavoriteAsync(Guid userId, Guid apartmentId, CancellationToken cancellationToken = default);
    }
}
