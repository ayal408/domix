using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;

namespace domix_server.Tests;

public class IntegrationResilienceTests
{
    private sealed class Geocoder : IGeocodingService
    {
        public Task<(double? Latitude, double? Longitude)> GetCoordinatesAsync(string city, string address, CancellationToken cancellationToken = default)
            => Task.FromResult<(double?, double?)>((null, null));
    }
    private sealed class Mail(Exception? error = null) : IEmailService
    {
        public int Sends;
        public Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
        { Sends++; return error is null ? Task.CompletedTask : Task.FromException(error); }
        public Task SendTestEmailAsync(string? recipientEmail = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
    private sealed class FailCompletion : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken ct = default)
        {
            if (eventData.Context!.ChangeTracker.Entries<SavedSearchEmail>().Any(e => e.Entity.Status == "Sent"))
                throw new IOException("Simulated database failure after provider accepted message");
            return ValueTask.FromResult(result);
        }
    }
    private static async Task Seed(ApartmentContext db)
    {
        await db.Database.EnsureCreatedAsync();
        var user = new User { UserId = Guid.NewGuid(), UserName = "outbox-test", RegistrationMethod = "Password" };
        var search = new SavedSearch { SavedSearchId = Guid.NewGuid(), UserId = user.UserId, Name = "Test" };
        db.Users.Add(user); db.SavedSearches.Add(search);
        db.SavedSearchEmails.Add(new SavedSearchEmail { SavedSearchId = search.SavedSearchId, Recipient = "test@example.com", Subject = "Test", HtmlBody = "<p>Test</p>" });
        await db.SaveChangesAsync();
    }
    [Fact]
    public async Task SuccessfulOutboxIsNotSentAgain()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseSqlite(connection).Options);
        await Seed(db);
        var mail = new Mail(); var dispatcher = new SavedSearchEmailDispatcher(db, mail, NullLogger<SavedSearchEmailDispatcher>.Instance);
        await dispatcher.DispatchAsync(default); await dispatcher.DispatchAsync(default);
        Assert.Equal(1, mail.Sends);
        Assert.Equal("Sent", (await db.SavedSearchEmails.SingleAsync()).Status);
    }
    [Fact]
    public async Task LostCompletionAfterProviderSuccessIsHeldAsUnknownRatherThanReplayed()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApartmentContext>().UseSqlite(connection).Options;
        await using (var setup = new ApartmentContext(options)) await Seed(setup);
        var mail = new Mail();
        await using (var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseSqlite(connection).AddInterceptors(new FailCompletion()).Options))
            await Assert.ThrowsAsync<IOException>(() => new SavedSearchEmailDispatcher(db, mail, NullLogger<SavedSearchEmailDispatcher>.Instance).DispatchAsync(default));
        await using var recovery = new ApartmentContext(options);
        await recovery.SavedSearchEmails.ExecuteUpdateAsync(s => s.SetProperty(x => x.AttemptedAt, DateTime.UtcNow.AddMinutes(-10)));
        await new SavedSearchEmailDispatcher(recovery, mail, NullLogger<SavedSearchEmailDispatcher>.Instance).DispatchAsync(default);
        Assert.Equal(1, mail.Sends);
        Assert.Equal("Unknown", (await recovery.SavedSearchEmails.SingleAsync()).Status);
    }
    [Fact]
    public async Task RejectedGmailGrantBlocksInsteadOfRetryingOrClaimingSuccess()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseSqlite(connection).Options);
        await Seed(db);
        var mail = new Mail(new GmailReconnectRequiredException());
        var dispatcher = new SavedSearchEmailDispatcher(db, mail, NullLogger<SavedSearchEmailDispatcher>.Instance);
        await dispatcher.DispatchAsync(default); await dispatcher.DispatchAsync(default);
        Assert.Equal(1, mail.Sends);
        Assert.Equal("Blocked", (await db.SavedSearchEmails.SingleAsync()).Status);
    }
    [Fact]
    public async Task SearchUsesFractionalRoomsAndStableBoundedPages()
    {
        await using var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var now = DateTime.UtcNow;
        for (int i = 0; i < 30; i++) db.Apartments.Add(new Apartment { ApartmentId = Guid.NewGuid(), SumOfRooms = 2.5m, dateInsert = now, city = "Test", address = "Street", area = "Area" });
        db.Apartments.Add(new Apartment { ApartmentId = Guid.NewGuid(), SumOfRooms = 2m, dateInsert = now });
        await db.SaveChangesAsync();
        var service = new ApartmentService(db, new Geocoder(), NullLogger<ApartmentService>.Instance);
        var first = (await service.SearchApartmentsAsync(null, null, null, null, 2.5m, 2.5m, null, null, null, null, pageSize: 24)).ToList();
        var second = (await service.SearchApartmentsAsync(null, null, null, null, 2.5m, 2.5m, null, null, null, null, offset: 24, pageSize: 24)).ToList();
        Assert.Equal(24, first.Count); Assert.Equal(6, second.Count);
        Assert.Empty(first.Select(x => x.ApartmentId).Intersect(second.Select(x => x.ApartmentId)));
    }
    [Fact]
    public async Task LinkingGooglePreservesPasswordLoginAndVerifiesAddress()
    {
        await using var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var user = new User { UserId = Guid.NewGuid(), UserName = "linked", PasswordHash = "existing-hash", RegistrationMethod = "Password" };
        db.Users.Add(user); await db.SaveChangesAsync();
        var service = new UserService(db, new Mail(), new ConfigurationBuilder().Build(), NullLogger<UserService>.Instance);
        await service.LinkGoogleAsync(new LinkGoogleDto { UserId = user.UserId, GoogleId = "google-id" });
        Assert.Equal("Password+Google", user.RegistrationMethod); Assert.Equal("existing-hash", user.PasswordHash); Assert.True(user.IsEmailVerified);
    }
}
