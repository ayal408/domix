using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;
namespace domix_server.Tests;
public class ConversationWorkflowTests
{
    private sealed class Mail:IEmailService{
        public Task SendEmailAsync(string to,string subject,string htmlBody,CancellationToken ct=default)=>Task.CompletedTask;
        public Task SendTestEmailAsync(string? recipientEmail=null,CancellationToken ct=default)=>Task.CompletedTask;
    }
    [Fact]public async Task ThreadsGroupBothDirectionsAndBlocksCoverLegacyAndThreadRoutes()
    {
        await using var db=new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var owner=new User{UserId=Guid.NewGuid(),UserName="private owner"};var buyer=new User{UserId=Guid.NewGuid(),UserName="buyer"};var third=Guid.NewGuid();
        var a=new Apartment{ApartmentId=Guid.NewGuid(),UserId=owner.UserId,city="Haifa",area="Center",address="Secret",IsAnonymous=true};
        db.Users.AddRange(owner,buyer);db.Apartments.Add(a);await db.SaveChangesAsync();
        var service=new MessageService(db,new Mail(),new ConfigurationBuilder().Build(),NullLogger<MessageService>.Instance);
        var first=await service.SendMessageAsync(new CreateMessageDto{ApartmentId=a.ApartmentId,Content="First"},buyer.UserId);
        var followup=await service.SendToThreadAsync(first.ConversationId,buyer.UserId,"Follow-up",default);
        Assert.Equal(first.ConversationId,followup.ConversationId);
        var reply=await service.SendToThreadAsync(first.ConversationId,owner.UserId,"Anonymous reply",default);
        Assert.True(reply.SenderIsAnonymous);Assert.Equal(Guid.Empty,reply.SenderId);
        var view=(await service.GetThreadAsync(first.ConversationId,buyer.UserId,null,default)).ToList();
        Assert.Equal(3,view.Count);Assert.Equal(2,view.Count(m=>m.IsMine));
        Assert.Empty(await service.GetThreadAsync(first.ConversationId,third,null,default));
        await Assert.ThrowsAsync<KeyNotFoundException>(()=>service.SendToThreadAsync(first.ConversationId,third,"Not permitted",default));
        db.UserBlocks.Add(new UserBlock{BlockerId=buyer.UserId,BlockedId=owner.UserId});await db.SaveChangesAsync();
        await Assert.ThrowsAsync<ArgumentException>(()=>service.SendToThreadAsync(first.ConversationId,owner.UserId,"Blocked",default));
        await Assert.ThrowsAsync<ArgumentException>(()=>service.ReplyAsync(first.MessageId,owner.UserId,"Blocked"));
        await Assert.ThrowsAsync<ArgumentException>(()=>service.SendMessageAsync(new CreateMessageDto{ApartmentId=a.ApartmentId,Content="Blocked"},buyer.UserId));
        Assert.Equal(3,await db.Messages.CountAsync());
        Assert.Equal(MessageService.ConversationKey(buyer.UserId,owner.UserId,a.ApartmentId),MessageService.ConversationKey(owner.UserId,buyer.UserId,a.ApartmentId));
        Assert.NotEqual(first.ConversationId,MessageService.ConversationKey(buyer.UserId,owner.UserId,Guid.NewGuid()));
    }
}
