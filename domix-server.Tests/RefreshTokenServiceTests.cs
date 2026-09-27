using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Services.Implementations;

namespace domix_server.Tests;

public class RefreshTokenServiceTests
{
    private static ApartmentContext MakeContext()
    {
        var options = new DbContextOptionsBuilder<ApartmentContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApartmentContext(options);
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

        await service.RevokeAsync(Guid.NewGuid(), jti, DateTime.UtcNow.AddDays(30));

        Assert.True(await service.IsRevokedAsync(jti));
    }

    [Fact]
    public async Task RevokeAsync_CalledTwiceForTheSameTokenDoesNotThrow()
    {
        var service = new RefreshTokenService(MakeContext());
        var userId = Guid.NewGuid();
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

        await service.RevokeAsync(Guid.NewGuid(), expiredJti, DateTime.UtcNow.AddDays(-1));
        await service.RevokeAsync(Guid.NewGuid(), stillValidJti, DateTime.UtcNow.AddDays(30));

        var purged = await service.PurgeExpiredAsync();

        Assert.Equal(1, purged);
        Assert.False(await service.IsRevokedAsync(expiredJti));
        Assert.True(await service.IsRevokedAsync(stillValidJti));
    }
}
