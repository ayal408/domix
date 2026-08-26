using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
        private readonly ApartmentContext _context;
        private readonly ILogger<UserService> _logger;

        public UserService(ApartmentContext context, ILogger<UserService> logger)
        {
            _context = context;
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
                Role = "User",
                ProfileImage = imageBytes,
                ProfileColor = $"#{hash[0]:X2}{hash[1]:X2}{hash[2]:X2}",
            };

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("User {UserId} created successfully.", newUser.UserId);
            return ToDto(newUser);
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

            if (string.IsNullOrEmpty(user.PasswordHash))
                return new VerifyPasswordResult { Outcome = PasswordVerifyOutcome.NoPasswordAccount };

            if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                return new VerifyPasswordResult { Outcome = PasswordVerifyOutcome.InvalidPassword };

            return new VerifyPasswordResult { Outcome = PasswordVerifyOutcome.Success, User = ToDto(user) };
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
                    : null
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