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

        /// <summary>
        /// Consumes a verification token: marks the owning account verified and clears the token.
        /// Returns false when the token is unknown or expired.
        /// </summary>
        Task<bool> VerifyEmailAsync(string token, CancellationToken cancellationToken = default);

        /// <summary>
        /// Issues a fresh verification token and re-sends the email. Returns false when the user
        /// doesn't exist, has no email on file, or is already verified.
        /// </summary>
        Task<bool> ResendVerificationEmailAsync(Guid userId, CancellationToken cancellationToken = default);

        /// <summary>Admin panel user list.</summary>
        Task<IEnumerable<UserResponseDto>> GetAllUsersAsync(CancellationToken cancellationToken = default);

        /// <summary>Returns null when no user with the given id exists.</summary>
        Task<UserResponseDto?> SetBlockedAsync(Guid userId, bool isBlocked, CancellationToken cancellationToken = default);

        /// <summary>Silently no-ops when the email doesn't match any account — never reveals whether it exists.</summary>
        Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken = default);

        /// <summary>Returns false when the token is unknown or expired.</summary>
        Task<bool> ResetPasswordAsync(string token, string passwordHash, CancellationToken cancellationToken = default);

        Task<UserResponseDto?> UpdateThemePreferenceAsync(Guid userId, string? themePreference, CancellationToken cancellationToken = default);

        /// <summary>Hard-deletes the account and everything it owns. Returns false when no user with the given id exists.</summary>
        Task<bool> DeleteAccountAsync(Guid userId, CancellationToken cancellationToken = default);
    }
}