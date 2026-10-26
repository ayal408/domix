using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Data;
using serverApi.Models;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;

namespace domix_server.Tests;

public class ApartmentRatingTests
{
    private sealed class Geocoder : IGeocodingService
    {
        public Task<(double? Latitude, double? Longitude)> GetCoordinatesAsync(string city, string address, CancellationToken cancellationToken = default)
            => Task.FromResult<(double?, double?)>((null, null));
    }
    private static async Task<(ApartmentContext Db, ApartmentService Service, Guid ApartmentId, Guid Owner, Guid[] Voters)> Fixture()
    {
        var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var ids = Enumerable.Range(0, 4).Select(_ => Guid.NewGuid()).ToArray();
        foreach (var id in ids) db.Users.Add(new User { UserId = id, UserName = id.ToString(), RegistrationMethod = "Password" });
        var apartment = new Apartment { ApartmentId = Guid.NewGuid(), UserId = ids[0], price = 5000, city = "Test", area = "Center", address = "Street", Rating = 4, RatingCount = 9 };
        db.Apartments.Add(apartment); await db.SaveChangesAsync();
        return (db, new ApartmentService(db, new Geocoder(), NullLogger<ApartmentService>.Instance), apartment.ApartmentId, ids[0], ids.Skip(1).ToArray());
    }
    [Fact]
    public async Task AverageIsExactAndHistoricalAggregateIsPreserved()
    {
        var f = await Fixture(); await using var db = f.Db;
        await f.Service.RateApartmentAsync(f.ApartmentId, f.Voters[0], 5);
        await f.Service.RateApartmentAsync(f.ApartmentId, f.Voters[1], 4);
        var result = await f.Service.RateApartmentAsync(f.ApartmentId, f.Voters[2], 5);
        Assert.Equal(14m / 3, result!.Rating); Assert.Equal(3, result.RatingCount);
        Assert.Equal(4, result.LegacyRating); Assert.Equal(9, result.LegacyRatingCount); Assert.False(result.RatingIsLegacy);
        Assert.Equal(3, await db.ApartmentRatings.CountAsync());
    }
    [Fact]
    public async Task RepeatedVoteChangesOneVoteInsteadOfInflatingTheCount()
    {
        var f = await Fixture(); await using var db = f.Db;
        await f.Service.RateApartmentAsync(f.ApartmentId, f.Voters[0], 2);
        var result = await f.Service.RateApartmentAsync(f.ApartmentId, f.Voters[0], 5);
        Assert.Equal(5, result!.Rating); Assert.Equal(1, result.RatingCount);
        Assert.Single(await db.ApartmentRatings.ToListAsync());
    }
    [Fact]
    public async Task OwnerCannotVoteAndInvalidScoresCannotBeStored()
    {
        var f = await Fixture(); await using var db = f.Db;
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => f.Service.RateApartmentAsync(f.ApartmentId, f.Owner, 5));
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => f.Service.RateApartmentAsync(f.ApartmentId, f.Voters[0], 6));
        Assert.Empty(await db.ApartmentRatings.ToListAsync());
    }
}
