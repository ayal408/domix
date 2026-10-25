using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;

namespace domix_server.Tests;
public class ExchangeWorkflowTests
{
    private readonly Guid first = Guid.NewGuid(), second = Guid.NewGuid(), stranger = Guid.NewGuid();
    private readonly DateOnly start = ExchangeMatching.Today.AddDays(5);
    private ApartmentContext Context() => new(new DbContextOptionsBuilder<ApartmentContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private Apartment Home(Guid user, string city = "חיפה") => new() { ApartmentId = Guid.NewGuid(), UserId = user, city = city, ListingType = "Exchange", DesiredCity = "ירושלים", AvailableFrom = start, AvailableTo = start.AddDays(20), GuestCapacity = 6 };
    private async Task<(Apartment A, Apartment B)> Homes(ApartmentContext db)
    {
        var a = Home(first); var b = Home(second, "ירושלים"); db.AddRange(a, b);
        db.Users.AddRange(new User { UserId = first, UserName = "First", IsEmailVerified = true, EmailAddress = "first@example.com" }, new User { UserId = second, UserName = "Second" });
        await db.SaveChangesAsync(); return (a, b);
    }
    private CreateExchangeAgreementDto Proposal(Apartment a, Apartment b, int nights = 3) => new() { OfferedApartmentId = a.ApartmentId, RequestedApartmentId = b.ApartmentId, Start = start, End = start.AddDays(nights), Guests = 4 };
    [Fact]
    public async Task PendingDoesNotReserve_AcceptReservesBoth_CancelReleasesBoth()
    {
        await using var db = Context(); var (a, b) = await Homes(db); var flow = new ExchangeWorkflow(db);
        var request = await flow.Create(first, Proposal(a, b), default);
        Assert.True(await flow.IsAvailable(a, start, start.AddDays(3), default));
        await Assert.ThrowsAsync<ExchangeForbidden>(() => flow.Decide(request.Id, first, new() { Action = "Accept" }, default));
        await flow.Decide(request.Id, second, new() { Action = "Accept", RecipientGuests = 2 }, default);
        Assert.False(await flow.IsAvailable(a, start, start.AddDays(3), default));
        Assert.False(await flow.IsAvailable(b, start, start.AddDays(3), default));
        Assert.True(await flow.IsAvailable(a, start.AddDays(3), start.AddDays(5), default));
        Assert.Equal(2, request.RecipientGuests);
        await flow.Decide(request.Id, first, new() { Action = "Cancel", Revision = 1 }, default);
        Assert.True(await flow.IsAvailable(a, start, start.AddDays(3), default));
        Assert.True(await flow.IsAvailable(b, start, start.AddDays(3), default));
    }
    [Fact]
    public async Task ASecondOverlappingAcceptanceFails_AndCapacityIsCheckedOnBothSides()
    {
        await using var db = Context(); var (a, b) = await Homes(db); var c = Home(second, "ירושלים"); db.Add(c); await db.SaveChangesAsync(); var flow = new ExchangeWorkflow(db);
        var one = await flow.Create(first, Proposal(a, b), default); var two = await flow.Create(first, Proposal(a, c, 4), default);
        await Assert.ThrowsAsync<ExchangeConflict>(() => flow.Decide(one.Id, second, new() { Action = "Accept", RecipientGuests = 7 }, default));
        await flow.Decide(one.Id, second, new() { Action = "Accept" }, default);
        await Assert.ThrowsAsync<ExchangeConflict>(() => flow.Decide(two.Id, second, new() { Action = "Accept" }, default));
        await Assert.ThrowsAsync<ExchangeConflict>(() => flow.AddPeriod(a.ApartmentId, first, new() { Start = start, End = start.AddDays(3), IsAvailable = false }, default));
    }
    [Fact]
    public async Task CounterChangesPartiesAndRequiresNewConsent_StaleOrUnrelatedActionsFail()
    {
        await using var db = Context(); var (a, b) = await Homes(db); var flow = new ExchangeWorkflow(db); var request = await flow.Create(first, Proposal(a, b), default);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => flow.Decide(request.Id, stranger, new() { Action = "Accept" }, default));
        var counter = await flow.Counter(request.Id, second, new() { Start = start.AddDays(1), End = start.AddDays(4), Guests = 2 }, default);
        Assert.Equal("Countered", request.Status); Assert.Equal(first, counter.RecipientId); Assert.Equal(second, counter.RequesterId);
        Assert.Equal(b.ApartmentId, counter.OfferedApartmentId); Assert.Equal(a.ApartmentId, counter.RequestedApartmentId);
        await Assert.ThrowsAsync<ExchangeConflict>(() => flow.Decide(request.Id, second, new() { Action = "Accept" }, default));
        await flow.Decide(counter.Id, first, new() { Action = "Accept" }, default);
    }
    [Fact]
    public async Task MultipleAvailabilityWindowsAndPersonalBlocksAreAuthoritative()
    {
        await using var db = Context(); var (a, _) = await Homes(db); var flow = new ExchangeWorkflow(db);
        await flow.AddPeriod(a.ApartmentId, first, new() { Start = start.AddDays(30), End = start.AddDays(33) }, default);
        await flow.AddPeriod(a.ApartmentId, first, new() { Start = start.AddDays(33), End = start.AddDays(36) }, default);
        Assert.True(await flow.IsAvailable(a, start.AddDays(31), start.AddDays(35), default));
        Assert.False(await flow.IsAvailable(a, start, start.AddDays(1), default));
        await flow.AddPeriod(a.ApartmentId, first, new() { Start = start.AddDays(32), End = start.AddDays(33), IsAvailable = false }, default);
        Assert.False(await flow.IsAvailable(a, start.AddDays(31), start.AddDays(35), default));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => flow.AddPeriod(a.ApartmentId, second, new() { Start = start, End = start.AddDays(1) }, default));
    }
    [Fact]
    public async Task BlockedUsersCannotCreateRequests_AndUnknownRequiredFeaturesDoNotMatch()
    {
        await using var db = Context(); var (a, b) = await Homes(db); var flow = new ExchangeWorkflow(db);
        var query = new ExchangeWatchDto { OfferedApartmentId = a.ApartmentId, Destination = "ירושלים", Start = start, End = start.AddDays(2), KosherKitchen = true };
        Assert.Empty((await ExchangeSearch.Find(db, first, query, default)).Homes);
        b.KosherKitchen = true; await db.SaveChangesAsync();
        Assert.Single((await ExchangeSearch.Find(db, first, query, default)).Homes);
        db.ExchangeUserBlocks.Add(new() { Id = Guid.NewGuid(), UserId = second, BlockedUserId = first }); await db.SaveChangesAsync();
        Assert.Empty((await ExchangeSearch.Find(db, first, query, default)).Homes);
        await Assert.ThrowsAsync<ExchangeForbidden>(() => flow.Create(first, Proposal(a, b), default));
    }
    [Fact]
    public async Task CompletionNeedsBothPartiesAndCannotBeConfirmedBeforeCheckout()
    {
        await using var db = Context(); var (a, b) = await Homes(db); var flow = new ExchangeWorkflow(db); var request = await flow.Create(first, Proposal(a, b), default);
        await flow.Decide(request.Id, second, new() { Action = "Accept" }, default);
        await Assert.ThrowsAsync<ExchangeConflict>(() => flow.Decide(request.Id, first, new() { Action = "Complete", Revision = 1 }, default));
        request.Start = ExchangeMatching.Today.AddDays(-3); request.End = ExchangeMatching.Today; await db.SaveChangesAsync();
        await flow.Decide(request.Id, first, new() { Action = "Complete", Revision = 1 }, default);
        Assert.Equal("Accepted", request.Status);
        await flow.Decide(request.Id, second, new() { Action = "Complete", Revision = 2 }, default);
        Assert.Equal("Completed", request.Status);
    }
    [Fact]
    public async Task AlertsAreOptInRespectCadenceAndDoNotRepeatKnownMatches()
    {
        await using var db = Context(); var (a, b) = await Homes(db); var watch = new ExchangeWatch { Id = Guid.NewGuid(), UserId = first, OfferedApartmentId = a.ApartmentId, Destination = "ירושלים", Start = start, End = start.AddDays(2) };
        db.ExchangeWatches.Add(watch); await db.SaveChangesAsync(); var email = new RecordingEmail();
        var delivery = new ExchangeWatchDelivery(db, email, new ConfigurationBuilder().Build(), NullLogger<ExchangeWatchDelivery>.Instance);
        await delivery.RunOnce(default); Assert.Equal(0, email.Count);
        watch.Frequency = "Daily"; await db.SaveChangesAsync(); await delivery.RunOnce(default); Assert.Equal(0, email.Count);
        watch.LastSentAt = DateTime.UtcNow.AddDays(-2); await db.SaveChangesAsync(); await delivery.RunOnce(default); Assert.Equal(1, email.Count);
        watch.Frequency = "Immediate"; await db.SaveChangesAsync(); await delivery.RunOnce(default); Assert.Equal(1, email.Count);
        Assert.Contains(b.ApartmentId.ToString(), watch.SeenIds);
    }
    [Fact]
    public async Task AcceptedUpcomingExchangePreventsDeletingEitherHomeOrAccount()
    {
        await using var db = Context(); var (a, b) = await Homes(db); var flow = new ExchangeWorkflow(db);
        var request = await flow.Create(first, Proposal(a, b), default);
        await flow.Decide(request.Id, second, new() { Action = "Accept" }, default);
        var apartments = new ApartmentService(db, null!, NullLogger<ApartmentService>.Instance);
        await Assert.ThrowsAsync<ExchangeConflict>(() => apartments.DeleteApartmentAsync(a.ApartmentId, first, false));
        var users = new UserService(db, new RecordingEmail(), new ConfigurationBuilder().Build(), NullLogger<UserService>.Instance);
        await Assert.ThrowsAsync<ExchangeConflict>(() => users.DeleteAccountAsync(first));
        Assert.Equal(2, await db.Apartments.CountAsync());
    }
    private class RecordingEmail : IEmailService
    {
        public int Count;
        public Task SendTestEmailAsync(string? recipientEmail = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default) { Count++; Assert.Contains("ניהול וביטול", htmlBody); return Task.CompletedTask; }
    }
}
