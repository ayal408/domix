using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.WebUtilities;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;
using System.Security.Cryptography;
using System.Text;
using SkiaSharp;

namespace serverApi.Services.Implementations
{
    public class UserService : IUserService
    {
        internal static string? NormalizeEmail(string? email) => string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();

        private static readonly TimeSpan VerificationTokenLifetime = TimeSpan.FromHours(24);

        private readonly ApartmentContext _context;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<UserService> _logger;

        public UserService(ApartmentContext context, IEmailService emailService, IConfiguration configuration, ILogger<UserService> logger)
        {
            _context = context;
            _emailService = emailService;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<UserResponseDto?> GetUserByIdAsync(string userId, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserId.ToString() == userId, cancellationToken);

            return user == null ? null : ToDto(user);
        }

        public async Task<UserResponseDto?> GetUserByEmailAsync(string email, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.NormalizedEmail == NormalizeEmail(email), cancellationToken);

            return user == null ? null : ToDto(user);
        }

        public async Task<UserResponseDto?> GetUserByUsernameAsync(string username, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserName == username, cancellationToken);

            return user == null ? null : ToDto(user);
        }

        public async Task<UserResponseDto?> GetUserByGoogleIdAsync(string googleId, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.GoogleId == googleId, cancellationToken);

            return user == null ? null : ToDto(user);
        }

        public async Task<UserResponseDto?> LookupUserAsync(string? email, string? username, string? googleId, CancellationToken cancellationToken = default)
        {
            User? user = null;

            if (!string.IsNullOrWhiteSpace(googleId))
                user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(x => x.GoogleId == googleId, cancellationToken);

            if (user == null && !string.IsNullOrWhiteSpace(email))
                user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(x => x.NormalizedEmail == NormalizeEmail(email), cancellationToken);

            if (user == null && !string.IsNullOrWhiteSpace(username))
                user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(x => x.UserName == username, cancellationToken);

            return user == null ? null : ToDto(user);
        }

        public async Task<UserResponseDto> CreateUserAsync(UserDto dto, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(dto.UserName) || dto.UserName.Length > 100 ||
                (!string.IsNullOrWhiteSpace(dto.EmailAddress) && !EmailService.IsMailbox(dto.EmailAddress.Trim())))
                throw new ArgumentException("Invalid account details.");
            byte[] imageBytes;

            if (!string.IsNullOrEmpty(dto.ProfileImageBase64))
            {
                imageBytes = await SanitizeProfileAsync(dto.ProfileImageBase64, cancellationToken);
            }
            else
            {
                imageBytes = GenerateIdenticon(dto.UserName);
            }

            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(dto.UserName.Trim().ToLower()));

            // A Google sign-in already proves the address is reachable — password accounts still
            // need to click a link we email them before IsEmailVerified flips to true.
            var isGoogleVerified = dto.RegistrationMethod == "Google";

            var newUser = new User
            {
                UserId = Guid.NewGuid(),
                RegistrationMethod = dto.RegistrationMethod,
                LanguagePreference = EmailText.Language(dto.LanguagePreference),
                UserName = dto.UserName.Trim(),
                PhoneNumber = dto.PhoneNumber,
                EmailAddress = dto.EmailAddress?.Trim(),
                NormalizedEmail = NormalizeEmail(dto.EmailAddress),
                PasswordHash = dto.PasswordHash,
                GoogleId = dto.GoogleId,
                JoiningDate = DateTime.UtcNow,
                Role = "User",
                ProfileImage = imageBytes,
                ProfileColor = $"#{hash[0]:X2}{hash[1]:X2}{hash[2]:X2}",
                IsEmailVerified = isGoogleVerified,
            };

            if (!isGoogleVerified && !string.IsNullOrWhiteSpace(dto.EmailAddress))
            {
                newUser.EmailVerificationToken = GenerateSecureToken();
                newUser.EmailVerificationTokenExpiresAt = DateTime.UtcNow.Add(VerificationTokenLifetime);
            }

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("User {UserId} created successfully.", newUser.UserId);

            if (newUser.EmailVerificationToken != null)
                await SendVerificationEmailAsync(newUser, cancellationToken);

            return ToDto(newUser);
        }

        public async Task<bool> VerifyEmailAsync(string token, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(token))
                return false;

            var user = await _context.Users.FirstOrDefaultAsync(u => u.EmailVerificationToken == token, cancellationToken);
            if (user == null || user.EmailVerificationTokenExpiresAt is null || user.EmailVerificationTokenExpiresAt < DateTime.UtcNow)
                return false;

            user.IsEmailVerified = true;
            user.EmailVerificationToken = null;
            user.EmailVerificationTokenExpiresAt = null;
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("User {UserId} verified their email.", user.UserId);
            return true;
        }

        public async Task<bool> ResendVerificationEmailAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
            if (user == null || user.IsEmailVerified || string.IsNullOrWhiteSpace(user.EmailAddress))
                return false;

            user.EmailVerificationToken = GenerateSecureToken();
            user.EmailVerificationTokenExpiresAt = DateTime.UtcNow.Add(VerificationTokenLifetime);
            await _context.SaveChangesAsync(cancellationToken);

            await SendVerificationEmailAsync(user, cancellationToken);
            return true;
        }

        private static string GenerateSecureToken() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

        public async Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.NormalizedEmail == NormalizeEmail(email), cancellationToken);
            // Deliberately silent on a miss — the caller (AuthController) always returns 200 either
            // way, so this can't be used to enumerate registered emails.
            if (user == null || string.IsNullOrWhiteSpace(user.EmailAddress))
                return;

            user.PasswordResetToken = GenerateSecureToken();
            user.PasswordResetTokenExpiresAt = DateTime.UtcNow.Add(VerificationTokenLifetime);
            await _context.SaveChangesAsync(cancellationToken);

            var clientAppUrl = (_configuration["CLIENT_APP_URL"] ?? "http://localhost").TrimEnd('/');
            var resetLink = $"{clientAppUrl}/reset-password?token={Uri.EscapeDataString(user.PasswordResetToken)}";

            try
            {
                var emailMessage = EmailText.PasswordReset(user.UserName, resetLink, user.LanguagePreference);
                await _emailService.SendEmailAsync(user.EmailAddress!, emailMessage.Subject, emailMessage.Html, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send password reset email to user {UserId}.", user.UserId);
            }
        }

        public async Task<bool> ResetPasswordAsync(string token, string passwordHash, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == token, cancellationToken);
            if (user == null || user.PasswordResetTokenExpiresAt is null || user.PasswordResetTokenExpiresAt < DateTime.UtcNow)
                return false;

            user.PasswordHash = passwordHash;
            // A Google-only account that resets its password gains a password login too, same as
            // LinkPasswordAsync — it must not silently downgrade a linked account back to Google-only.
            if (user.RegistrationMethod == "Google")
                user.RegistrationMethod = "Password+Google";
            user.PasswordResetToken = null;
            user.PasswordResetTokenExpiresAt = null;
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("User {UserId} reset their password.", user.UserId);
            return true;
        }

        public async Task<UserResponseDto?> UpdateThemePreferenceAsync(Guid userId, string? themePreference, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
            if (user == null) return null;

            user.ThemePreference = themePreference;
            await _context.SaveChangesAsync(cancellationToken);
            return ToDto(user);
        }

        public async Task<bool> DeleteAccountAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
            if (user == null) return false;

            // Scrub support copies explicitly: SET NULL on the relationship alone does not remove contact data.
            var tickets = await _context.SupportTickets.Where(t => t.UserId == userId).ToListAsync(cancellationToken);
            foreach (var ticket in tickets)
            {
                ticket.ContactName = null; ticket.ContactEmail = null; ticket.Transcript = null;
                ticket.Message = "תוכן הפנייה הוסר בעקבות מחיקת החשבון";
                ticket.UserId = null; ticket.Status = SupportTicketStatus.Resolved; ticket.ResolvedAt = DateTime.UtcNow;
            }
            // Tombstone the account and withdraw its listings; retain both sides' message/deal history.
            user.IsDeleted = true;
            user.DeletedAt = DateTime.UtcNow;
            user.IsBlocked = true;
            user.Role = "User";
            user.UserName = "deleted-" + user.UserId.ToString("N");
            user.EmailAddress = null;
            user.NormalizedEmail = null;
            user.GoogleId = null;
            user.PasswordHash = null;
            user.PhoneNumber = null;
            user.SharePhone = false;
            user.ProfileImage = null;
            user.ProfileColor = null;
            user.EmailVerificationToken = null;
            user.EmailVerificationTokenExpiresAt = null;
            user.PasswordResetToken = null;
            user.PasswordResetTokenExpiresAt = null;
            var apartments = await _context.Apartments.Where(a => a.UserId == userId).ToListAsync(cancellationToken);
            foreach (var apartment in apartments) { apartment.IsDeleted = true; apartment.DeletedAt = user.DeletedAt; }
            var queued = await _context.SavedSearchEmails.Where(x => x.SavedSearch.UserId == userId &&
                x.Status != "Sending").ToListAsync(cancellationToken);
            foreach (var item in queued)
            {
                if (item.Status is "Pending" or "Blocked") item.Status = "Cancelled";
                item.Recipient = ""; item.Subject = ""; item.HtmlBody = "";
            }
            var searches = await _context.SavedSearches.Where(x => x.UserId == userId).ToListAsync(cancellationToken);
            foreach (var search in searches)
            {
                search.Name = "חיפוש שנמחק"; search.City = null; search.Area = null; search.PropertyType = null;
                search.ListingType = null; search.MinPrice = null; search.MaxPrice = null;
                search.MinRooms = null; search.MaxRooms = null; search.Parking = null; search.Elevator = null;
            }
            var oldSearches = await _context.SearchRequests.Where(x => x.UserId == userId).ToListAsync(cancellationToken);
            _context.SearchRequests.RemoveRange(oldSearches);
            var favorites = await _context.Favorites.Where(f => f.UserId == userId).ToListAsync(cancellationToken);
            _context.Favorites.RemoveRange(favorites);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("User {UserId} account deleted.", userId);
            return true;
        }

        private async Task SendVerificationEmailAsync(User user, CancellationToken cancellationToken)
        {
            var clientAppUrl = (_configuration["CLIENT_APP_URL"] ?? "http://localhost").TrimEnd('/');
            var verifyLink = $"{clientAppUrl}/verify-email?token={Uri.EscapeDataString(user.EmailVerificationToken!)}";

            try
            {
                var emailMessage = EmailText.Verification(user.UserName, verifyLink, user.LanguagePreference);
                await _emailService.SendEmailAsync(user.EmailAddress!, emailMessage.Subject, emailMessage.Html, cancellationToken);
            }
            catch (Exception ex)
            {
                // Same tolerance as MessageService's notification email: the account still exists
                // and can request a fresh link via resend-verification, so this must not fail the
                // caller's request (registration or resend) just because mail delivery is down.
                _logger.LogError(ex, "Failed to send verification email to user {UserId}.", user.UserId);
            }
        }

        public async Task<User?> LinkGoogleAsync(LinkGoogleDto dto, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users.FindAsync(new object[] { dto.UserId }, cancellationToken);
            if (user == null) return null;

            if (user.IsBlocked) throw new UnauthorizedAccessException("ACCOUNT_BLOCKED");
            if (!string.IsNullOrEmpty(user.GoogleId) && user.GoogleId != dto.GoogleId)
                throw new InvalidOperationException("GOOGLE_ACCOUNT_ALREADY_LINKED");
            user.GoogleId = dto.GoogleId;
            user.IsEmailVerified = true;
            user.RegistrationMethod = string.IsNullOrEmpty(user.PasswordHash) ? "Google" : "Password+Google";

            await _context.SaveChangesAsync(cancellationToken);
            return user;
        }

        public async Task<User?> LinkPasswordAsync(LinkPasswordDto dto, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users.FindAsync(new object[] { dto.UserId }, cancellationToken);
            if (user == null) return null;

            user.PasswordHash = dto.PasswordHash;
            user.RegistrationMethod = "Password+Google";
            if (!string.IsNullOrWhiteSpace(dto.UserName))
                user.UserName = dto.UserName;

            await _context.SaveChangesAsync(cancellationToken);
            return user;
        }

        private static async Task<byte[]> SanitizeProfileAsync(string value, CancellationToken ct)
        {
            if (value.Length > 14_000_000) throw new ArgumentException("התמונה גדולה מדי");
            try
            {
                var base64 = value.Contains(',') ? value.Split(',')[1] : value;
                using var input = new MemoryStream(Convert.FromBase64String(base64));
                return await PrivacyImages.SanitizeAsync(input, ct);
            }
            catch (FormatException) { throw new ArgumentException("התמונה אינה תקינה"); }
        }

        public async Task<UserResponseDto?> UpdateProfileImageAsync(Guid userId, string profileImageBase64, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
            if (user == null) return null;

            var base64 = profileImageBase64.Contains(",") ? profileImageBase64.Split(',')[1] : profileImageBase64;
            if (string.IsNullOrWhiteSpace(base64))
                throw new ArgumentException("Empty image after split");

            byte[] imageBytes = await SanitizeProfileAsync(base64, cancellationToken);

            var oldImage = user.ProfileImage != null ? (byte[])user.ProfileImage.Clone() : null;
            user.ProfileImage = imageBytes;

            var changes = await _context.SaveChangesAsync(cancellationToken);
            if (changes == 0 || (oldImage != null && oldImage.SequenceEqual(imageBytes)))
            {
                return null;
            }

            return ToDto(user);
        }

        public async Task<VerifyPasswordResult> VerifyPasswordAsync(string userName, string password, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserName == userName, cancellationToken);

            if (user == null)
                return new VerifyPasswordResult { Outcome = PasswordVerifyOutcome.UserNotFound };

            if (user.IsBlocked)
                return new VerifyPasswordResult { Outcome = PasswordVerifyOutcome.Blocked };

            if (string.IsNullOrEmpty(user.PasswordHash))
                return new VerifyPasswordResult { Outcome = PasswordVerifyOutcome.NoPasswordAccount };

            if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                return new VerifyPasswordResult { Outcome = PasswordVerifyOutcome.InvalidPassword };

            return new VerifyPasswordResult { Outcome = PasswordVerifyOutcome.Success, User = ToDto(user) };
        }

        public async Task<IEnumerable<UserResponseDto>> GetAllUsersAsync(CancellationToken cancellationToken = default)
        {
            var users = await _context.Users
                .AsNoTracking()
                .OrderByDescending(u => u.JoiningDate)
                .ToListAsync(cancellationToken);

            return users.Select(ToDto);
        }

        public async Task<UserResponseDto?> SetBlockedAsync(Guid userId, bool isBlocked, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
            if (user == null)
                return null;

            user.IsBlocked = isBlocked;
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("User {UserId} {Action}.", userId, isBlocked ? "blocked" : "unblocked");
            return ToDto(user);
        }

        private static byte[] GenerateIdenticon(string input, int size = 256)
        {
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(input.Trim().ToLower()));
            using var bitmap = new SKBitmap(size, size);
            using var canvas = new SKCanvas(bitmap);
            canvas.Clear(SKColors.White);
            using var paint = new SKPaint { Color = new SKColor(hash[0], hash[1], hash[2]), IsAntialias = false };
            var cell = size / 5;
            for (var y = 0; y < 5; y++)
                for (var x = 0; x < 3; x++)
                    if (hash[(x + y * 5) % hash.Length] % 2 == 0)
                    {
                        canvas.DrawRect(x * cell, y * cell, cell, cell, paint);
                        canvas.DrawRect((4 - x) * cell, y * cell, cell, cell, paint);
                    }
            using var image = SKImage.FromBitmap(bitmap);
            using var encoded = image.Encode(SKEncodedImageFormat.Png, 100);
            return encoded.ToArray();
        }

        private static UserResponseDto ToDto(User user)
        {
            return new UserResponseDto
            {
                UserId = user.UserId,
                UserName = user.UserName,
                EmailAddress = user.EmailAddress,
                PhoneNumber = user.PhoneNumber,
                SharePhone = user.SharePhone,
                Role = user.Role,
                JoiningDate = user.JoiningDate,
                ProfileColor = user.ProfileColor,
                GoogleId = user.GoogleId,
                RegistrationMethod = user.RegistrationMethod,
                ProfileImageBase64 = user.ProfileImage != null
                    ? Convert.ToBase64String(user.ProfileImage)
                    : null,
                IsEmailVerified = user.IsEmailVerified,
                IsBlocked = user.IsBlocked,
                ThemePreference = user.ThemePreference,
                LanguagePreference = user.LanguagePreference,
            };
        }

        // מימוש תאימות לשירות הקודם מתוך AuthController
        public async Task<UserResponseDto?> GetUserByIdentifierAsync(string identifier, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserName == identifier || x.NormalizedEmail == NormalizeEmail(identifier), cancellationToken);

            return user == null ? null : ToDto(user);
        }

        public async Task<UserResponseDto> RegisterAsync(UserDto dto, CancellationToken cancellationToken = default)
        {
            return await CreateUserAsync(dto, cancellationToken);
        }
    }
}
