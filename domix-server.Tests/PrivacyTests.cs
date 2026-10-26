using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Controllers;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Metadata.Profiles.Exif;

namespace domix_server.Tests;

public class PrivacyTests
{
    private static ApartmentContext Db() => new(new DbContextOptionsBuilder<ApartmentContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static DefaultHttpContext Http(Guid id, string role = "User") => new() { User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("userId", id.ToString()), new Claim(ClaimTypes.Role, role) }, "test")) };
    private static User Owner() => new() { UserId = Guid.NewGuid(), UserName = "Owner", EmailAddress = "owner@example.com", PhoneNumber = "0501234567", GoogleId = "secret-google-id" };
    private static Apartment Home(Guid owner) => new() { ApartmentId = Guid.NewGuid(), UserId = owner, city = "Test", area = "Center", address = "Private street 42", price = 5000, Latitude = 32.1234, Longitude = 34.5678 };
    private sealed class Mail : IEmailService
    {
        public List<string> Bodies { get; } = new();
        public Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default) { Bodies.Add(htmlBody); return Task.CompletedTask; }
        public Task SendTestEmailAsync(string? recipientEmail = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
    private sealed class Geo : IGeocodingService
    {
        public Task<(double? Latitude, double? Longitude)> GetCoordinatesAsync(string city, string address, CancellationToken cancellationToken = default) => Task.FromResult<(double?, double?)>((null, null));
    }
    private static IConfiguration Config(Dictionary<string, string?>? values = null) => new ConfigurationBuilder().AddInMemoryCollection(values ?? new()).Build();
    [Fact]
    public async Task OtherUserCannotReadFullProfile_EvenWithKnownId()
    {
        await using var db = Db(); var owner = Owner(); db.Users.Add(owner); await db.SaveChangesAsync();
        var service = new UserService(db, new Mail(), Config(), NullLogger<UserService>.Instance);
        var controller = new UserController(service, NullLogger<UserController>.Instance) { ControllerContext = new() { HttpContext = Http(Guid.NewGuid()) } };
        Assert.IsType<ForbidResult>(await controller.GetById(owner.UserId.ToString(), default));
        controller.HttpContext.User = Http(owner.UserId).User;
        Assert.IsType<OkObjectResult>(await controller.GetById(owner.UserId.ToString(), default));
    }
    [Fact]
    public async Task AnonymousListingHidesIdentityAndExactLocation_ExceptFromOwner()
    {
        await using var db = Db(); var owner = Owner(); var home = Home(owner.UserId); home.IsAnonymous = true;
        db.Add(owner); db.Add(home); await db.SaveChangesAsync();
        var accessor = new HttpContextAccessor { HttpContext = Http(Guid.NewGuid()) };
        var service = new ApartmentService(db, new Geo(), NullLogger<ApartmentService>.Instance, accessor);
        var other = (await service.GetApartmentByIdAsync(home.ApartmentId))!;
        Assert.Equal(Guid.Empty, other.UserId); Assert.Equal(home.area, other.address); Assert.Null(other.Latitude); Assert.Null(other.Longitude);
        Assert.Empty(await service.SearchApartmentsAsync(null, null, null, null, null, null, null, null, null, null, ownerId: owner.UserId));
        accessor.HttpContext = Http(owner.UserId);
        var own = (await service.GetApartmentByIdAsync(home.ApartmentId))!;
        Assert.Equal(owner.UserId, own.UserId); Assert.Equal(home.address, own.address);
    }
    [Fact]
    public async Task ContactCardDoesNotContainAccountIdentifiers_AndPhoneRequiresOptIn()
    {
        await using var db = Db(); var owner = Owner(); var home = Home(owner.UserId); db.Add(owner); db.Add(home); await db.SaveChangesAsync();
        var controller = new PrivacyController(db) { ControllerContext = new() { HttpContext = Http(Guid.NewGuid()) } };
        var result = Assert.IsType<OkObjectResult>(await controller.Contact(home.ApartmentId, default));
        var json = JsonSerializer.Serialize(result.Value);
        Assert.DoesNotContain(owner.EmailAddress!, json); Assert.DoesNotContain(owner.PhoneNumber!, json); Assert.DoesNotContain(owner.GoogleId!, json);
        owner.SharePhone = true; await db.SaveChangesAsync();
        Assert.Contains(owner.PhoneNumber!, JsonSerializer.Serialize(Assert.IsType<OkObjectResult>(await controller.Contact(home.ApartmentId, default)).Value));
        home.IsAnonymous = true; await db.SaveChangesAsync();
        Assert.IsType<NotFoundResult>(await controller.Contact(home.ApartmentId, default));
    }
    [Fact]
    public async Task AnonymousOwnerCanReceiveInquiryWithoutClientKnowingOwnerId()
    {
        await using var db = Db(); var owner = Owner(); var sender = new User { UserId = Guid.NewGuid(), UserName = "Sender" };
        var home = Home(owner.UserId); home.IsAnonymous = true; db.AddRange(owner, sender); db.Add(home); await db.SaveChangesAsync();
        var service = new MessageService(db, new Mail(), Config(), NullLogger<MessageService>.Instance);
        await service.SendMessageAsync(new CreateMessageDto { ApartmentId = home.ApartmentId, Content = "Hello" }, sender.UserId);
        var message = await db.Messages.SingleAsync(); Assert.Equal(owner.UserId, message.OwnerId); Assert.DoesNotContain(home.address, message.ApartmentSnapshot);
        await Assert.ThrowsAsync<ArgumentException>(() => service.SendMessageAsync(new CreateMessageDto { ApartmentId = home.ApartmentId, OwnerId = Guid.NewGuid(), Content = "Spoof" }, sender.UserId));
    }
    [Theory]
    [InlineData(false)] [InlineData(true)]
    public async Task TranscriptIsOptionalAndNeverCopiedIntoNotificationEmail(bool optedIn)
    {
        await using var db = Db(); var mail = new Mail();
        var service = new SupportService(db, mail, Config(new() { ["ADMIN_NOTIFICATION_EMAIL"] = "team@example.com" }), NullLogger<SupportService>.Instance);
        var result = await service.CreateAsync(new CreateSupportTicketDto { ContactEmail = "guest@example.com", Message = "Private request", IncludeTranscript = optedIn,
            Transcript = new() { new ChatTurnDto { Role = "user", Text = "Secret conversation" } } }, null);
        Assert.Equal(optedIn, result.Transcript is not null);
        Assert.All(mail.Bodies, body => { Assert.DoesNotContain("Secret conversation", body); Assert.DoesNotContain("Private request", body); });
    }
    [Fact]
    public async Task ImageMetadataIsRemovedAndImageIsReencoded()
    {
        using var image = new Image<Rgba32>(3, 3);
        image.Metadata.ExifProfile = new ExifProfile(); image.Metadata.ExifProfile.SetValue(ExifTag.Artist, "Private owner");
        using var source = new MemoryStream(); await image.SaveAsJpegAsync(source); source.Position = 0;
        var bytes = await PrivacyImages.SanitizeAsync(source, default);
        using var sanitized = Image.Load(bytes); Assert.Null(sanitized.Metadata.ExifProfile); Assert.Null(sanitized.Metadata.XmpProfile);
        await Assert.ThrowsAsync<ArgumentException>(() => PrivacyImages.SanitizeAsync(new MemoryStream(new byte[] { 0xff, 0xd8, 0xff }), default));
    }
    [Fact]
    public async Task AccountDeletionScrubsSupportAndQueuedDeliveryCopies()
    {
        await using var db = Db(); var owner = Owner(); var search = new SavedSearch { SavedSearchId = Guid.NewGuid(), UserId = owner.UserId, Name = "Search" };
        db.Add(owner); db.Add(search); db.Add(new SupportTicket { UserId = owner.UserId, ContactName = "Name", ContactEmail = owner.EmailAddress, Transcript = "Private transcript", Message = "Private message" });
        db.Add(new SavedSearchEmail { SavedSearchId = search.SavedSearchId, Recipient = owner.EmailAddress!, HtmlBody = "Private body", Subject = "Subject" }); await db.SaveChangesAsync();
        await new UserService(db, new Mail(), Config(), NullLogger<UserService>.Instance).DeleteAccountAsync(owner.UserId);
        var ticket = await db.SupportTickets.SingleAsync(); Assert.Null(ticket.ContactEmail); Assert.Null(ticket.Transcript); Assert.Null(ticket.UserId); Assert.DoesNotContain("Private", ticket.Message);
        var delivery = await db.SavedSearchEmails.SingleAsync(); Assert.Equal("Cancelled", delivery.Status); Assert.Equal("", delivery.HtmlBody); Assert.Equal("", delivery.Recipient);
    }
    [Fact]
    public async Task RetentionIsDisabledByDefault_AndOnlyPurgesApprovedResolvedData()
    {
        await using var db = Db(); var closed = new SupportTicket { Status = SupportTicketStatus.Resolved, ResolvedAt = DateTime.UtcNow.AddDays(-100), Message = "Closed" };
        var open = new SupportTicket { Message = "Open", CreatedAt = DateTime.UtcNow.AddDays(-200) }; db.AddRange(closed, open); await db.SaveChangesAsync();
        await new PrivacyMaintenance(db, Config(), NullLogger<PrivacyMaintenance>.Instance).SweepAsync(default); Assert.Equal(2, await db.SupportTickets.CountAsync());
        await new PrivacyMaintenance(db, Config(new() { ["Privacy:ResolvedSupportRetentionDays"] = "90" }), NullLogger<PrivacyMaintenance>.Instance).SweepAsync(default);
        Assert.Equal("Open", (await db.SupportTickets.SingleAsync()).Message);
    }
    [Fact]
    public async Task ArchivedMediaStopsServingBeforeDiskCleanup_AndCleanupKeepsActiveFiles()
    {
        await using var db = Db(); var owner = Owner(); var home = Home(owner.UserId); var archived = Home(owner.UserId); archived.IsDeleted = true;
        var url = "/images/" + Guid.NewGuid() + ".jpg"; var path = PrivacyImages.LocalPath(url)!; Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        using var picture = new Image<Rgba32>(2, 2); await picture.SaveAsJpegAsync(path);
        db.Add(owner); db.AddRange(home, archived); db.AddRange(new ApartmentImage { ImageId = Guid.NewGuid(), ApartmentId = archived.ApartmentId, ImageUrl = url }, new ApartmentImage { ImageId = Guid.NewGuid(), ApartmentId = home.ApartmentId, ImageUrl = url }); await db.SaveChangesAsync();
        var maintenance = new PrivacyMaintenance(db, Config(), NullLogger<PrivacyMaintenance>.Instance);
        try
        {
            await maintenance.SweepAsync(default); Assert.True(File.Exists(path));
            home.IsDeleted = true; await db.SaveChangesAsync();
            var media = new MediaController(db) { ControllerContext = new() { HttpContext = new DefaultHttpContext() } };
            Assert.IsType<NotFoundResult>(await media.Get(url[8..], default)); Assert.True(File.Exists(path));
            await maintenance.SweepAsync(default); Assert.False(File.Exists(path));
            await maintenance.SweepAsync(default); // idempotent after restart/retry
        }
        finally { File.Delete(path); }
    }
    [Fact]
    public async Task ArchivedListingRetentionClearsOnlyApprovedArchivedContent()
    {
        await using var db = Db(); var owner = Owner(); var active = Home(owner.UserId); var archived = Home(owner.UserId);
        archived.IsDeleted = true; archived.DeletedAt = DateTime.UtcNow.AddDays(-40); archived.description = "Personal details";
        db.Add(owner); db.AddRange(active, archived); await db.SaveChangesAsync();
        await new PrivacyMaintenance(db, Config(), NullLogger<PrivacyMaintenance>.Instance).SweepAsync(default);
        Assert.Equal("Private street 42", archived.address);
        await new PrivacyMaintenance(db, Config(new() { ["Privacy:ArchivedListingContentRetentionDays"] = "30" }), NullLogger<PrivacyMaintenance>.Instance).SweepAsync(default);
        Assert.Equal("", archived.address); Assert.Equal("", archived.description); Assert.Null(archived.Latitude);
        Assert.Equal("Private street 42", active.address);
    }

    [Theory]
    [InlineData("/images/../../secrets.jpg")] [InlineData("https://tracker.test/a.jpg")] [InlineData("/images/%2e%2e/a.jpg")]
    public void MediaPathRejectsTraversalAndExternalUrls(string path) => Assert.Null(PrivacyImages.LocalPath(path));
    [Fact]
    public void ObviousDirectIdentifiersAreRemovedBeforeModelProcessing()
    {
        var result = PrivacyText.Minimize("Contact jane@example.com or 050-123-4567; 3 rooms in Haifa");
        Assert.DoesNotContain("jane@example.com", result); Assert.DoesNotContain("050-123-4567", result); Assert.Contains("3 rooms", result);
    }
}
