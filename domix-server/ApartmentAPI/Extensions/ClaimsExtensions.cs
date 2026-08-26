using System.Security.Claims;

namespace serverApi.Extensions
{
    public static class ClaimsExtensions
    {
        public static Guid GetUserId(this ClaimsPrincipal user)
        {
            if (user == null)
                throw new ArgumentNullException(nameof(user));

            var value = user.FindFirst("userId")?.Value ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(value) || !Guid.TryParse(value, out var userId))
                throw new UnauthorizedAccessException("User ID claim is missing or invalid.");

            return userId;
        }

        public static string GetRole(this ClaimsPrincipal user)
        {
            if (user == null)
                throw new ArgumentNullException(nameof(user));

            return user.FindFirst(ClaimTypes.Role)?.Value ?? "User";
        }
    }
}