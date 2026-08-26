using serverApi.Models;
using serverApi.Models.DTOs;

namespace serverApi.Services.Interfaces
{
    public interface IUserService
    {
        Task<UserResponseDto?> GetUserByIdAsync(string userId, CancellationToken cancellationToken = default);
        Task<UserResponseDto?> GetUserByEmailAsync(string email, CancellationToken cancellationToken = default);
        Task<UserResponseDto?> GetUserByUsernameAsync(string username, CancellationToken cancellationToken = default);
        Task<UserResponseDto?> GetUserByGoogleIdAsync(string googleId, CancellationToken cancellationToken = default);
        Task<UserResponseDto?> LookupUserAsync(string? email, string? username, string? googleId, CancellationToken cancellationToken = default);
        Task<UserResponseDto> CreateUserAsync(UserDto dto, CancellationToken cancellationToken = default);
        Task<User?> LinkGoogleAsync(LinkGoogleDto dto, CancellationToken cancellationToken = default);
        Task<User?> LinkPasswordAsync(LinkPasswordDto dto, CancellationToken cancellationToken = default);
        Task<UserResponseDto?> UpdateProfileImageAsync(Guid userId, string profileImageBase64, CancellationToken cancellationToken = default);

        /// <summary>Verifies a password against the stored hash without ever returning the hash itself.</summary>
        Task<VerifyPasswordResult> VerifyPasswordAsync(string userName, string password, CancellationToken cancellationToken = default);

        // Compatibility methods used by AuthController
        Task<UserResponseDto?> GetUserByIdentifierAsync(string identifier, CancellationToken cancellationToken = default);
        Task<UserResponseDto> RegisterAsync(UserDto dto, CancellationToken cancellationToken = default);
    }
}