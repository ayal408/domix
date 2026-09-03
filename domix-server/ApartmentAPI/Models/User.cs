using System.ComponentModel.DataAnnotations;

namespace serverApi.Models
{
    public class User
    {
        [Key]
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string RegistrationMethod { get; set; } = "Password"; // Password / Google / Facebook / OTP

        public string? PhoneNumber { get; set; }
        public string? GoogleId { get; set; }
        public string? EmailAddress { get; set; }
        public string? PasswordHash { get; set; }
        public string Role { get; set; } = "User";
        public byte[]? ProfileImage { get; set; }
        public string? ProfileColor { get; set; }
        public DateTime JoiningDate { get; set; } = DateTime.UtcNow;

        public bool IsEmailVerified { get; set; } = false;
        public string? EmailVerificationToken { get; set; }
        public DateTime? EmailVerificationTokenExpiresAt { get; set; }

        public bool IsBlocked { get; set; } = false;

        public string? PasswordResetToken { get; set; }
        public DateTime? PasswordResetTokenExpiresAt { get; set; }

        /// <summary>"light" | "dark" | "system" | null (unset — client falls back to its own default).</summary>
        public string? ThemePreference { get; set; }

        /// <summary>Notifications created after this time count as unread. Null means none have ever been seen.</summary>
        public DateTime? NotificationsSeenAt { get; set; }

        public List<Appointment> Appointments { get; set; } = new();
        public List<Apartment> Apartments { get; set; } = new();
        public List<SearchRequest> SearchRequests { get; set; } = new();
        public List<RefreshToken> RefreshTokens { get; set; } = new();
    }
}