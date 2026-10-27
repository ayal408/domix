using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;
namespace domix_server.Tests;
public class PrivateMessageReplyTests
{
    private sealed class Mail : IEmailService
    {
        public Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken ct = default) => Task.CompletedTask;
        public Task SendTestEmailAsync(string? recipientEmail = null, CancellationToken ct = default) => Task.CompletedTask;
    }
    [Fact]
    public async Task AnonymousRepliesRemainPrivateAcrossRoundsAndListingChanges()
    {
        await using var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var owner = new User { UserId = Guid.NewGuid(), UserName = "private owner", EmailAddress = "private@example.com" };
        var buyer = new User { UserId = Guid.NewGuid(), UserName = "buyer" };
        var stranger = new User { UserId = Guid.NewGuid(), UserName = "stranger" };
        var listing = new Apartment { ApartmentId = Guid.NewGuid(), UserId = owner.UserId, city = "Haifa", area = "Center", address = "Secret street", IsAnonymous = true };
        db.Users.AddRange(owner, buyer, stranger); db.Apartments.Add(listing); await db.SaveChangesAsync();
        var service = new MessageService(db, new Mail(), new ConfigurationBuilder().Build(), NullLogger<MessageService>.Instance);
        var inquiry = await service.SendMessageAsync(new CreateMessageDto { ApartmentId = listing.ApartmentId, Content = "Available?" }, buyer.UserId);
        Assert.Equal(Guid.Empty, inquiry.OwnerId);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.ReplyAsync(inquiry.MessageId, stranger.UserId, "attack"));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.ReplyAsync(inquiry.MessageId, buyer.UserId, "attack"));
        await Assert.ThrowsAsync<ArgumentException>(() => service.ReplyAsync(inquiry.MessageId, owner.UserId, "   "));
        await Assert.ThrowsAsync<ArgumentException>(() => service.ReplyAsync(inquiry.MessageId, owner.UserId, new string('x', 2001)));
        listing.IsAnonymous = false; listing.IsDeleted = true; await db.SaveChangesAsync();
        var reply = await service.ReplyAsync(inquiry.MessageId, owner.UserId, "Yes, please arrange a visit");
        Assert.True(reply.SenderIsAnonymous); Assert.Equal(Guid.Empty, reply.SenderId); Assert.Null(reply.SenderName); Assert.Null(reply.SenderImageBase64);
        Assert.DoesNotContain("Secret street", reply.ApartmentSnapshot!);
        var received = Assert.Single(await service.GetOwnerMessagesAsync(buyer.UserId, 1, 20));
        Assert.True(received.SenderIsAnonymous); Assert.Equal(Guid.Empty, received.SenderId); Assert.Null(received.SenderName);
        await service.ArchiveMessageAsync(reply.MessageId, buyer.UserId);
        Assert.True(Assert.Single(await service.GetArchivedMessagesAsync(buyer.UserId)).SenderIsAnonymous);
        var next = await service.ReplyAsync(reply.MessageId, buyer.UserId, "When can I visit?");
        Assert.Equal(Guid.Empty, next.OwnerId); Assert.False(next.SenderIsAnonymous);
        var final = await service.ReplyAsync(next.MessageId, owner.UserId, "Tomorrow");
        Assert.True(final.SenderIsAnonymous); Assert.Equal(Guid.Empty, final.SenderId);
        Assert.Equal(owner.UserId, (await db.Messages.SingleAsync(m => m.MessageId == final.MessageId)).SenderId);
        await service.DeleteMessageAsync(final.MessageId, buyer.UserId);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.ReplyAsync(final.MessageId, buyer.UserId, "Cannot reply to a deleted message"));
    }
}
