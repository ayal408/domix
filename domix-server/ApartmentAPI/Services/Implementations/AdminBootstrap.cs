using Microsoft.EntityFrameworkCore;
using serverApi.Data;

namespace serverApi.Services.Implementations;

/// <summary>Operator-only CLI action; never invoked from public registration or ordinary startup.</summary>
public static class AdminBootstrap
{
    public static async Task PromoteAsync(ApartmentContext db, Guid userId, CancellationToken ct = default)
    {
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            // The same lock protects concurrent bootstrap commands on different server instances.
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(728140801)", ct);
            var user = await db.Users.SingleOrDefaultAsync(u => u.UserId == userId, ct);
            if (user is null || user.IsBlocked || !user.IsEmailVerified)
                throw new InvalidOperationException("Bootstrap requires an existing active user with a verified email.");
            if (await db.Users.AnyAsync(u => u.Role == "Admin" && u.UserId != userId, ct))
                throw new InvalidOperationException("An administrator already exists; use the existing administrator instead.");
            user.Role = "Admin";
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        });
    }
}
