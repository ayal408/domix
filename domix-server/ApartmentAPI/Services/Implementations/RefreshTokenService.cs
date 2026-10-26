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
            await ConsumeAsync(userId, jti, expires, cancellationToken);
        }

        public async Task<bool> ConsumeAsync(Guid userId, string jti, DateTime expires, CancellationToken cancellationToken = default)
        {
            if (userId == Guid.Empty || string.IsNullOrWhiteSpace(jti)) return false;
            var now = DateTime.UtcNow;
            // ON CONFLICT is atomic across processes; check-then-insert is not.
            var inserted = await _context.Database.ExecuteSqlInterpolatedAsync($@"
                INSERT INTO ""RefreshTokens"" (""Token"", ""UserId"", ""Created"", ""Expires"", ""IsRevoked"", ""RevokedAt"", ""ReplacedByToken"")
                VALUES ({jti}, {userId}, {now}, {expires}, TRUE, {now}, '')
                ON CONFLICT (""Token"") DO NOTHING", cancellationToken);
            return inserted == 1;
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
