using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Services.Implementations;

namespace domix_server.Tests;

public class RefreshTokenServiceTests
{
    private static readonly Guid UserId = Guid.NewGuid();
    private static ApartmentContext MakeContext()
    {
        var options = new DbContextOptionsBuilder<ApartmentContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        var db = new ApartmentContext(options);
        db.Database.OpenConnection();
        db.Database.EnsureCreated();
        db.Users.Add(new serverApi.Models.User { UserId = UserId, UserName = "refresh-test", RegistrationMethod = "Password" });
        db.SaveChanges();
        return db;
    }

    [Fact]
    public async Task ConsumeIsSingleUseAndCreatesExactlyOneRow()
    {
        await using var db = MakeContext();
        var service = new RefreshTokenService(db);
        var jti = Guid.NewGuid().ToString();
        Assert.True(await service.ConsumeAsync(UserId, jti, DateTime.UtcNow.AddDays(1)));
        Assert.False(await service.ConsumeAsync(UserId, jti, DateTime.UtcNow.AddDays(1)));
        Assert.Equal(1, await db.RefreshTokens.CountAsync());
    }

    [Fact]
    public async Task IsRevokedAsync_ReturnsFalseForATokenThatWasNeverRevoked()
    {
        var service = new RefreshTokenService(MakeContext());

        Assert.False(await service.IsRevokedAsync(Guid.NewGuid().ToString()));
    }

    [Fact]
    public async Task RevokeAsync_ThenIsRevokedAsync_ReturnsTrue()
    {
        var service = new RefreshTokenService(MakeContext());
        var jti = Guid.NewGuid().ToString();

        await service.RevokeAsync(UserId, jti, DateTime.UtcNow.AddDays(30));

        Assert.True(await service.IsRevokedAsync(jti));
    }

    [Fact]
    public async Task RevokeAsync_CalledTwiceForTheSameTokenDoesNotThrow()
    {
        var service = new RefreshTokenService(MakeContext());
        var userId = UserId;
        var jti = Guid.NewGuid().ToString();

        await service.RevokeAsync(userId, jti, DateTime.UtcNow.AddDays(30));
        await service.RevokeAsync(userId, jti, DateTime.UtcNow.AddDays(30));

        Assert.True(await service.IsRevokedAsync(jti));
    }

    [Fact]
    public async Task IsRevokedAsync_ReturnsFalseForAnEmptyJti()
    {
        var service = new RefreshTokenService(MakeContext());

        Assert.False(await service.IsRevokedAsync(""));
    }

    [Fact]
    public async Task PurgeExpiredAsync_RemovesOnlyRowsPastTheirExpiry()
    {
        var service = new RefreshTokenService(MakeContext());
        var expiredJti = Guid.NewGuid().ToString();
        var stillValidJti = Guid.NewGuid().ToString();

        await service.RevokeAsync(UserId, expiredJti, DateTime.UtcNow.AddDays(-1));
        await service.RevokeAsync(UserId, stillValidJti, DateTime.UtcNow.AddDays(30));

        var purged = await service.PurgeExpiredAsync();

        Assert.Equal(1, purged);
        Assert.False(await service.IsRevokedAsync(expiredJti));
        Assert.True(await service.IsRevokedAsync(stillValidJti));
    }
}
