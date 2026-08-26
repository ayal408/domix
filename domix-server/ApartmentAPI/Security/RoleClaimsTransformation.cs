using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using serverApi.Data;

namespace serverApi.Security
{
    /// <summary>
    /// Adds a `ClaimTypes.Role` claim to every authenticated request.
    ///
    /// The access token minted by auth-server deliberately carries no role
    /// (see domix-client's AuthUser type) — the data API is the sole source of
    /// truth for authorization. This runs once per request, after JWT bearer
    /// authentication succeeds, and looks the role up by the `userId` claim so
    /// `[Authorize(Roles = "...")]` and policy-based authorization have
    /// something to evaluate. A role change therefore takes effect on the
    /// caller's very next request rather than waiting for a token refresh.
    /// </summary>
    public class RoleClaimsTransformation : IClaimsTransformation
    {
        private readonly ApartmentContext _context;

        public RoleClaimsTransformation(ApartmentContext context)
        {
            _context = context;
        }

        public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
        {
            if (principal.Identity?.IsAuthenticated != true)
                return principal;

            if (principal.HasClaim(c => c.Type == ClaimTypes.Role))
                return principal;

            var userIdValue = principal.FindFirst("userId")?.Value
                ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (!Guid.TryParse(userIdValue, out var userId))
                return principal;

            var role = await _context.Users
                .AsNoTracking()
                .Where(u => u.UserId == userId)
                .Select(u => u.Role)
                .FirstOrDefaultAsync();

            var identity = (ClaimsIdentity)principal.Identity;
            identity.AddClaim(new Claim(ClaimTypes.Role, role ?? "User"));

            return principal;
        }
    }
}
