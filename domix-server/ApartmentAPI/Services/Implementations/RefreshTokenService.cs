using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Models;
using serverApi.Services.Interfaces;

namespace serverApi.Services.Implementations
{
    public class RefreshTokenService : IRefreshTokenService
    {
        private readonly ApartmentContext _context;

        public RefreshTokenService(ApartmentContext context)
        {
            _context = context;
        }

        public async Task RevokeAsync(Guid userId, string jti, DateTime expires, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(jti))
                return;

            // Idempotent: logout can be called more than once for the same token (double-click,
            // retried request) without erroring or creating duplicate rows.
            var alreadyRevoked = await _context.RefreshTokens
                .AnyAsync(t => t.Token == jti, cancellationToken);
            if (alreadyRevoked)
                return;

            _context.RefreshTokens.Add(new RefreshToken
            {
                Token = jti,
                UserId = userId,
                Expires = expires,
                IsRevoked = true,
                RevokedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task<bool> IsRevokedAsync(string jti, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(jti))
                return false;

            return await _context.RefreshTokens.AnyAsync(t => t.Token == jti, cancellationToken);
        }

        public async Task<int> PurgeExpiredAsync(CancellationToken cancellationToken = default)
        {
            var now = DateTime.UtcNow;
            var expired = await _context.RefreshTokens
                .Where(t => t.Expires < now)
                .ToListAsync(cancellationToken);

            if (expired.Count == 0)
                return 0;

            _context.RefreshTokens.RemoveRange(expired);
            await _context.SaveChangesAsync(cancellationToken);
            return expired.Count;
        }
    }
}
