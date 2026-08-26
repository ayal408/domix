using System.ComponentModel.DataAnnotations;

namespace serverApi.Models.DTOs
{
    public class UserDto
    {
        public string UserName { get; set; } = null!;
        public required string RegistrationMethod { get; set; }
        public string? PasswordHash { get; set; }
        public string? EmailAddress { get; set; }
        public string? PhoneNumber { get; set; }
        public string? GoogleId { get; set; }
        public string? ProfileImageBase64 { get; set; }
    }

    public class UserResponseDto
    {
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public required string RegistrationMethod { get; set; }
        public string? GoogleId { get; set; }
        public string? EmailAddress { get; set; }
        public string? PhoneNumber { get; set; }
        public string Role { get; set; } = "User";
        public DateTime JoiningDate { get; set; }
        public string? ProfileColor { get; set; }
        public string? ProfileImageBase64 { get; set; }
    }

    public class UpdateProfileImageDto
    {
        public string ProfileImage { get; set; } = string.Empty;
    }

    public class LinkGoogleDto
    {
        public Guid UserId { get; set; }
        public string GoogleId { get; set; } = string.Empty;
    }

    public class LinkPasswordDto
    {
        public Guid UserId { get; set; }
        public string PasswordHash { get; set; } = string.Empty;
        public string? UserName { get; set; }
    }

    /// <summary>
    /// auth-server's only way to check a password. The hash itself never
    /// crosses this boundary — verification happens inside this service and
    /// only the outcome (plus the profile, on success) goes back.
    /// </summary>
    public class VerifyPasswordDto
    {
        public string UserName { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public enum PasswordVerifyOutcome
    {
        Success,
        UserNotFound,
        NoPasswordAccount,
        InvalidPassword,
    }

    public class VerifyPasswordResult
    {
        public required PasswordVerifyOutcome Outcome { get; set; }
        public UserResponseDto? User { get; set; }
    }
}