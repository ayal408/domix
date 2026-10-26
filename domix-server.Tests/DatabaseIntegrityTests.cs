using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;

namespace domix_server.Tests;

public class DatabaseIntegrityTests
{
    private sealed class Mail : IEmailService
    {
        public Task SendEmailAsync(string to, string subject, string body, CancellationToken ct = default) => Task.CompletedTask;
        public Task SendTestEmailAsync(string? recipientEmail = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
    private static async Task<ApartmentContext> Context()
    {
        var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync(); return db;
    }
    private static UserService Users(ApartmentContext db) => new(db, new Mail(), new ConfigurationBuilder().Build(), NullLogger<UserService>.Instance);
    private static Apartment Home(Guid owner) => new() { ApartmentId = Guid.NewGuid(), UserId = owner, price = 5000.90m, city = "Test", address = "Street", area = "Center" };
    [Fact]
    public async Task FirstPublicAccountIsAnOrdinaryUserAndCanonicalEmailIsQueryable()
    {
        await using var db = await Context(); var users = Users(db);
        var user = await users.CreateUserAsync(new UserDto { UserName = "First", EmailAddress = "Case@Example.com", RegistrationMethod = "Password" });
        Assert.Equal("User", user.Role);
        Assert.Equal(user.UserId, (await users.LookupUserAsync("case@example.com", null, null))!.UserId);
        await Assert.ThrowsAsync<DbUpdateException>(() => users.CreateUserAsync(new UserDto { UserName = "Second", EmailAddress = "case@example.com", RegistrationMethod = "Password" }));
    }
    [Theory]
    [InlineData("negative-price")]
    [InlineData("blank-city")]
    [InlineData("invalid-status")]
    [InlineData("reversed-exchange")]
    public async Task DatabaseRejectsInvalidListing(string example)
    {
        await using var db = await Context(); var user = new User { UserId = Guid.NewGuid(), UserName = "Owner" }; db.Add(user); await db.SaveChangesAsync();
        var home = Home(user.UserId);
        if (example == "negative-price") home.price = -1;
        if (example == "blank-city") home.city = " ";
        if (example == "invalid-status") home.Status = (ApartmentStatus)999;
        if (example == "reversed-exchange") { home.ListingType = "Exchange"; home.DesiredCity = "Other"; home.AvailableFrom = new DateOnly(2099, 1, 2); home.AvailableTo = new DateOnly(2099, 1, 1); }
        db.Add(home); await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }
    [Fact]
    public void ListingRequestRejectsUnrepresentableFractionalPrices()
    {
        var request = new CreateApartmentDTO { city = "Test", address = "Street", area = "Center", price = 5000.901m };
        var errors = request.Validate(new System.ComponentModel.DataAnnotations.ValidationContext(request)).ToList();
        Assert.Contains(errors, e => e.MemberNames.Contains("price"));
        request.price = 5000.90m;
        Assert.Empty(request.Validate(new System.ComponentModel.DataAnnotations.ValidationContext(request)));
    }

    [Fact]
    public async Task PriceRoundTripPreservesAgorot_AndExchangeCanBeFree()
    {
        await using var db = await Context(); var user = new User { UserId = Guid.NewGuid(), UserName = "Owner" }; db.Add(user); await db.SaveChangesAsync();
        var home = Home(user.UserId); db.Add(home);
        var exchange = Home(user.UserId); exchange.price = 0; exchange.ListingType = "Exchange"; exchange.DesiredCity = "Other"; exchange.AvailableFrom = new DateOnly(2099, 1, 1); exchange.AvailableTo = new DateOnly(2099, 1, 2); db.Add(exchange);
        await db.SaveChangesAsync(); db.ChangeTracker.Clear();
        Assert.Equal(5000.90m, (await db.Apartments.SingleAsync(x => x.ApartmentId == home.ApartmentId)).price);
    }
    [Fact]
    public async Task DeletingAccountRetainsCorrespondenceAndWithdrawsListings()
    {
        await using var db = await Context(); var sender = new User { UserId = Guid.NewGuid(), UserName = "Sender", EmailAddress = "sender@example.com", PasswordHash = "private-hash" };
        var owner = new User { UserId = Guid.NewGuid(), UserName = "Recipient" }; db.AddRange(sender, owner); await db.SaveChangesAsync();
        var home = Home(sender.UserId); db.Add(home); await db.SaveChangesAsync();
        db.Messages.Add(new Message { MessageId = Guid.NewGuid(), SenderId = sender.UserId, OwnerId = owner.UserId, ApartmentId = home.ApartmentId, Content = "Keep this conversation", CreatedAt = DateTime.UtcNow });
        db.ClosingDeals.Add(new ClosingDeal { ClosingDealId = Guid.NewGuid(), ApartmentId = home.ApartmentId, idUserManager = owner.UserId, idUserBuyer = sender.UserId });
        await db.SaveChangesAsync();
        Assert.True(await Users(db).DeleteAccountAsync(sender.UserId)); db.ChangeTracker.Clear();
        Assert.Null(await Users(db).GetUserByIdAsync(sender.UserId.ToString()));
        Assert.Empty(await db.Apartments.ToListAsync());
        Assert.Single(await db.Messages.ToListAsync()); Assert.Single(await db.ClosingDeals.ToListAsync());
        var archived = await db.Users.IgnoreQueryFilters().SingleAsync(x => x.UserId == sender.UserId);
        Assert.True(archived.IsDeleted); Assert.True(archived.IsBlocked); Assert.Null(archived.EmailAddress); Assert.Null(archived.PasswordHash);
        var service = new MessageService(db, new Mail(), new ConfigurationBuilder().Build(), NullLogger<MessageService>.Instance);
        var messages = (await service.GetOwnerMessagesAsync(owner.UserId, 1, 20)).ToList();
        Assert.Single(messages); Assert.Equal("חשבון שנמחק", messages[0].SenderName);
    }
    [Fact]
    public async Task ForeignKeyRejectsOrphanMessage_AndHardDeletionCannotEraseReceivedHistory()
    {
        await using var db = await Context(); var sender = new User { UserId = Guid.NewGuid(), UserName = "Sender" }; var owner = new User { UserId = Guid.NewGuid(), UserName = "Owner" }; db.AddRange(sender, owner); await db.SaveChangesAsync();
        db.Messages.Add(new Message { MessageId = Guid.NewGuid(), SenderId = sender.UserId, OwnerId = owner.UserId, ApartmentId = Guid.NewGuid() });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync()); db.ChangeTracker.Clear();
        db.Messages.Add(new Message { MessageId = Guid.NewGuid(), SenderId = sender.UserId, OwnerId = owner.UserId }); await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        await Assert.ThrowsAsync<DbUpdateException>(async () =>
        {
            db.Remove(await db.Users.SingleAsync(u => u.UserId == sender.UserId));
            await db.SaveChangesAsync();
        });
    }
}
