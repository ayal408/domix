using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Models;
using serverApi.Services.Implementations;

namespace domix_server.Tests;

public class ExchangeDiscoveryAnalyticsTests
{
    [Fact]
    public async Task CountsActualProposalsAndRepliesWithoutTreatingThemAsCompletedSwaps()
    {
        await using var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var sender = Guid.NewGuid(); var owner = Guid.NewGuid(); var home = Guid.NewGuid(); var offered = Guid.NewGuid();
        var now = DateTime.UtcNow;
        Apartment Home(string city, ApartmentStatus status = ApartmentStatus.Available) => new() {
            ApartmentId = Guid.NewGuid(), UserId = owner, city = city, ListingType = "Exchange", Status = status,
            AvailableFrom = ExchangeMatching.Today.AddDays(2), AvailableTo = ExchangeMatching.Today.AddDays(5)
        };
        db.Apartments.AddRange(Home(" ירושלים "), Home("ירושלים"), Home("חיפה", ApartmentStatus.Sold));
        Message Proposal(DateTime at) => new() { MessageId = Guid.NewGuid(), SenderId = sender, OwnerId = owner,
            ApartmentId = home, OfferedApartmentId = offered, ExchangeStart = ExchangeMatching.Today.AddDays(2),
            ExchangeEnd = ExchangeMatching.Today.AddDays(5), CreatedAt = at };
        var deleted = Proposal(now.AddHours(-2)); deleted.IsDeleted = true;
        db.Messages.AddRange(Proposal(now.AddHours(-3)), Proposal(now.AddDays(-10)), deleted,
            new Message { MessageId = Guid.NewGuid(), SenderId = owner, OwnerId = sender, ApartmentId = home, CreatedAt = now.AddHours(-1) },
            new Message { MessageId = Guid.NewGuid(), SenderId = Guid.NewGuid(), OwnerId = owner, CreatedAt = now });
        await db.SaveChangesAsync();
        var summary = await new AnalyticsService(db).GetSummaryAsync();
        Assert.Equal(2, summary.AvailableExchangeHomes);
        Assert.Equal(2, Assert.Single(summary.ExchangeSupplyByCity).Homes);
        Assert.Equal("ירושלים", summary.ExchangeSupplyByCity[0].City);
        Assert.Equal(1, summary.ExchangeInquiriesLast7Days);
        Assert.Equal(1, summary.ExchangeSeekersLast7Days);
        Assert.Equal(1, summary.ExchangeInquiriesWithReplyLast7Days);
    }
}
