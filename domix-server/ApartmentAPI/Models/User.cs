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

        public List<Appointment> Appointments { get; set; } = new();
        public List<Apartment> Apartments { get; set; } = new();
        public List<SearchRequest> SearchRequests { get; set; } = new();
        public List<RefreshToken> RefreshTokens { get; set; } = new();
    }
}