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
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
// Removed dependency on SixLabors.ImageSharp.Drawing to avoid license requirement

namespace serverApi.Services.Implementations
{
    public class UserService : IUserService
    {
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
                .FirstOrDefaultAsync(x => x.EmailAddress == email, cancellationToken);

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
                user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(x => x.EmailAddress == email, cancellationToken);

            if (user == null && !string.IsNullOrWhiteSpace(username))
                user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(x => x.UserName == username, cancellationToken);

            return user == null ? null : ToDto(user);
        }

        public async Task<UserResponseDto> CreateUserAsync(UserDto dto, CancellationToken cancellationToken = default)
        {
            byte[] imageBytes;

            if (!string.IsNullOrEmpty(dto.ProfileImageBase64))
            {
                imageBytes = Convert.FromBase64String(dto.ProfileImageBase64);
            }
            else
            {
                imageBytes = GenerateIdenticon(dto.UserName);
            }

            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(dto.UserName.Trim().ToLower()));

            // A Google sign-in already proves the address is reachable — password accounts still
            // need to click a link we email them before IsEmailVerified flips to true.
            var isGoogleVerified = dto.RegistrationMethod == "Google";

            // Bootstraps the very first account as Admin — there is no seed data and no other way to
            // reach the admin panel on a fresh database. Every account after it defaults to "User".
            var isFirstUser = !await _context.Users.AnyAsync(cancellationToken);

            var newUser = new User
            {
                UserId = Guid.NewGuid(),
                RegistrationMethod = dto.RegistrationMethod,
                UserName = dto.UserName,
                PhoneNumber = dto.PhoneNumber,
                EmailAddress = dto.EmailAddress,
                PasswordHash = dto.PasswordHash,
                GoogleId = dto.GoogleId,
                JoiningDate = DateTime.UtcNow,
                Role = isFirstUser ? "Admin" : "User",
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
            var user = await _context.Users.FirstOrDefaultAsync(u => u.EmailAddress == email, cancellationToken);
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
                await _emailService.SendEmailAsync(
                    user.EmailAddress!,
                    "Reset your DOMIX password",
                    EmailTemplates.Render(
                        "Reset your password",
                        $"<p>Hi {System.Net.WebUtility.HtmlEncode(user.UserName)},</p>" +
                        "<p>We got a request to reset your DOMIX password. Click below to choose a new one — this link expires in 24 hours.</p>" +
                        "<p>If you didn't request this, you can safely ignore this email.</p>",
                        "Reset my password",
                        resetLink),
                    cancellationToken);
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

            // Every other FK to Users cascades (Apartments, Messages, Favorites, SavedSearches,
            // RefreshTokens, SearchRequests) or SETs NULL (SupportTickets, Notifications) — this is
            // the one Restrict relationship, so it must be cleared explicitly or the delete below
            // fails at the database level.
            var ownAppointments = _context.Appointments.Where(a => a.UserId == userId);
            _context.Appointments.RemoveRange(ownAppointments);

            _context.Users.Remove(user);
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
                await _emailService.SendEmailAsync(
                    user.EmailAddress!,
                    "Confirm your DOMIX email address",
                    EmailTemplates.Render(
                        "Confirm your email",
                        $"<p>Hi {System.Net.WebUtility.HtmlEncode(user.UserName)},</p>" +
                        "<p>Please confirm your email address to finish setting up your DOMIX account. This link expires in 24 hours.</p>",
                        "Verify my email",
                        verifyLink),
                    cancellationToken);
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

            user.GoogleId = dto.GoogleId;
            user.RegistrationMethod = "Google";

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

        public async Task<UserResponseDto?> UpdateProfileImageAsync(Guid userId, string profileImageBase64, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
            if (user == null) return null;

            var base64 = profileImageBase64.Contains(",") ? profileImageBase64.Split(',')[1] : profileImageBase64;
            if (string.IsNullOrWhiteSpace(base64))
                throw new ArgumentException("Empty image after split");

            byte[] imageBytes = Convert.FromBase64String(base64);

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

        private byte[] GenerateIdenticon(string input, int size = 256)
        {
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(input.Trim().ToLower()));
            var color = new Rgba32(hash[0], hash[1], hash[2]);

            int grid = 5;
            int cell = size / grid;

            using var image = new Image<Rgba32>(size, size);

            // Fill background
            image.Mutate(ctx => ctx.BackgroundColor(new Rgba32(255, 255, 255)));

            for (int y = 0; y < grid; y++)
            {
                for (int x = 0; x < (grid + 1) / 2; x++)
                {
                    int i = (x + y * grid) % hash.Length;

                    if (hash[i] % 2 == 0)
                    {
                        int x1 = x * cell;
                        int y1 = y * cell;
                        int x2 = (grid - 1 - x) * cell;
                        int y2 = y1;

                        // draw filled rectangles by drawing pixels manually for compatibility
                        for (int yy = 0; yy < cell; yy++)
                        {
                            for (int xx = 0; xx < cell; xx++)
                            {
                                int px1 = x1 + xx;
                                int py1 = y1 + yy;
                                int px2 = x2 + xx;
                                int py2 = y2 + yy;

                                if (px1 >= 0 && px1 < size && py1 >= 0 && py1 < size)
                                    image[px1, py1] = color;
                                if (px2 >= 0 && px2 < size && py2 >= 0 && py2 < size)
                                    image[px2, py2] = color;
                            }
                        }
                    }
                }
            }

            using var ms = new MemoryStream();
            image.SaveAsPng(ms);
            return ms.ToArray();
        }

        private static UserResponseDto ToDto(User user)
        {
            return new UserResponseDto
            {
                UserId = user.UserId,
                UserName = user.UserName,
                EmailAddress = user.EmailAddress,
                PhoneNumber = user.PhoneNumber,
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
            };
        }

        // מימוש תאימות לשירות הקודם מתוך AuthController
        public async Task<UserResponseDto?> GetUserByIdentifierAsync(string identifier, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserName == identifier || x.EmailAddress == identifier, cancellationToken);

            return user == null ? null : ToDto(user);
        }

        public async Task<UserResponseDto> RegisterAsync(UserDto dto, CancellationToken cancellationToken = default)
        {
            return await CreateUserAsync(dto, cancellationToken);
        }
    }
}