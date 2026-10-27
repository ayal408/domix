using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Controllers;
using serverApi.Data;
using serverApi.Hubs;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;

namespace domix_server.Tests;

public class MessageDeliveryPreferencesTests
{
    private sealed class Mail : IEmailService
    {
        public int Count;
        public Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken ct = default) { Count++; return Task.CompletedTask; }
        public Task SendTestEmailAsync(string? recipientEmail = null, CancellationToken ct = default) => Task.CompletedTask;
    }
    private sealed class Proxy(Action<string, object?[]> sent) : IClientProxy
    { public Task SendCoreAsync(string method, object?[] args, CancellationToken ct = default) { sent(method, args); return Task.CompletedTask; } }
    private sealed class Targets(IClientProxy proxy) : IHubClients
    {
        public string? Target;
        public IClientProxy Group(string name) { Target = name; return proxy; }
        public IClientProxy All => throw new InvalidOperationException("Private events must not broadcast.");
        public IClientProxy AllExcept(IReadOnlyList<string> ids) => throw new NotSupportedException();
        public IClientProxy Client(string id) => throw new NotSupportedException();
        public IClientProxy Clients(IReadOnlyList<string> ids) => throw new NotSupportedException();
        public IClientProxy GroupExcept(string name, IReadOnlyList<string> ids) => throw new NotSupportedException();
        public IClientProxy Groups(IReadOnlyList<string> names) => throw new NotSupportedException();
        public IClientProxy User(string id) => throw new NotSupportedException();
        public IClientProxy Users(IReadOnlyList<string> ids) => throw new NotSupportedException();
    }
    private sealed class Hub(IHubClients clients) : IHubContext<PresenceHub>
    { public IHubClients Clients => clients; public IGroupManager Groups => throw new NotSupportedException(); }
    [Theory]
    [InlineData(false, 0)]
    [InlineData(true, 1)]
    public async Task RecipientPreferenceControlsOnlyEmailAndPrivateEventFollowsPersistence(bool email, int expected)
    {
        await using var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var sender = new User { UserId = Guid.NewGuid(), UserName = "sender", EmailAddress = "sender@example.com" };
        var recipient = new User { UserId = Guid.NewGuid(), UserName = "recipient", EmailAddress = "recipient@example.com", ReceiveMessageEmails = email };
        db.Users.AddRange(sender, recipient); await db.SaveChangesAsync();
        var mail = new Mail(); var events = 0;
        var targets = new Targets(new Proxy((method, args) => {
            events++; Assert.Equal("MessageReceived", method); Assert.Single(db.Messages);
            var json = JsonSerializer.Serialize(args);
            Assert.DoesNotContain("private message body", json); Assert.DoesNotContain("sender@example.com", json);
        }));
        var service = new MessageService(db, mail, new ConfigurationBuilder().Build(), NullLogger<MessageService>.Instance, new Hub(targets));
        var message = await service.SendMessageAsync(new CreateMessageDto { OwnerId = recipient.UserId, Content = "private message body" }, sender.UserId);
        Assert.Equal(expected, mail.Count); Assert.Equal(1, events);
        Assert.Equal(PresenceHub.MessageGroup(recipient.UserId), targets.Target);
        Assert.Equal(1, await service.GetUnreadCountAsync(recipient.UserId)); Assert.Equal(0, await service.GetUnreadCountAsync(sender.UserId));
        await service.MarkAsReadAsync(message.MessageId, recipient.UserId);
        Assert.Equal(0, await service.GetUnreadCountAsync(recipient.UserId));
    }
    [Fact]
    public async Task PreferenceUpdateAffectsOnlyTheAuthenticatedAccount()
    {
        await using var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var one = new User { UserId = Guid.NewGuid(), UserName = "one" }; var two = new User { UserId = Guid.NewGuid(), UserName = "two" };
        db.Users.AddRange(one, two); await db.SaveChangesAsync();
        var controller = new PrivacyController(db) { ControllerContext = new() { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("userId", one.UserId.ToString()) }, "test")) } } };
        await controller.SaveMessagePreferences(new(false), default);
        Assert.False(one.ReceiveMessageEmails); Assert.True(two.ReceiveMessageEmails);
    }
}
