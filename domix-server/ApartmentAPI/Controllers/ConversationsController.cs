using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;
namespace serverApi.Controllers;
[ApiController, Route("api/conversations"), Authorize]
public class ConversationsController(ApartmentContext db, IMessageService messages) : ControllerBase
{
    private Guid Caller => Guid.Parse(User.FindFirst("userId")?.Value ?? User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private Task<Message?> Anchor(Guid id, CancellationToken ct) => db.Messages.AsNoTracking()
        .Where(m => m.ConversationId == id && !m.IsDeleted && (m.SenderId == Caller || m.OwnerId == Caller))
        .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.MessageId).FirstOrDefaultAsync(ct);
    private Guid Other(Message m) => m.SenderId == Caller ? m.OwnerId : m.SenderId;
    private Task<bool> Blocked(Guid other, CancellationToken ct) => db.UserBlocks.AnyAsync(b => (b.BlockerId == Caller && b.BlockedId == other) || (b.BlockerId == other && b.BlockedId == Caller), ct);
    [HttpGet] public async Task<IActionResult> List([FromQuery] int offset = 0, CancellationToken ct = default) => Ok(await messages.ThreadsAsync(Caller, Math.Clamp(offset,0,100000), ct));
    [HttpGet("{id:guid}/messages")] public async Task<IActionResult> Thread(Guid id, [FromQuery] Guid? beforeId = null, CancellationToken ct = default)
    { if (await Anchor(id,ct) == null) return NotFound(); return Ok(await messages.GetThreadAsync(id,Caller,beforeId,ct)); }
    [HttpPost("{id:guid}/messages")] public async Task<IActionResult> Send(Guid id, ReplyMessageDto input, CancellationToken ct)
    { try { return Ok(await messages.SendToThreadAsync(id, Caller, input.Content, ct)); } catch(KeyNotFoundException) { return NotFound(); } catch(ArgumentException) { return BadRequest(); } }
    [HttpPost("{id:guid}/read")] public async Task<IActionResult> Read(Guid id, CancellationToken ct)
    {
        if(await Anchor(id,ct) == null) return NotFound();
        await db.Messages.Where(m=>m.ConversationId==id && m.OwnerId==Caller && !m.IsDeleted && !m.IsRead)
            .ExecuteUpdateAsync(s=>s.SetProperty(m=>m.IsRead,true).SetProperty(m=>m.ReadAt,DateTime.UtcNow),ct);
        return NoContent();
    }
    [HttpGet("{id:guid}/safety")] public async Task<IActionResult> Safety(Guid id, CancellationToken ct)
    { var a=await Anchor(id,ct); if(a==null)return NotFound(); var other=Other(a); return Ok(new { BlockedByMe=await db.UserBlocks.AnyAsync(b=>b.BlockerId==Caller && b.BlockedId==other,ct), CanMessage=!await Blocked(other,ct) }); }
    public record BlockInput(bool Block);
    [HttpPost("{id:guid}/block")] public async Task<IActionResult> Block(Guid id, BlockInput input, CancellationToken ct)
    {
        var a=await Anchor(id,ct);if(a==null)return NotFound();var other=Other(a);if(other==Caller)return BadRequest();
        var block=await db.UserBlocks.FindAsync(new object[]{Caller,other},ct);
        if(input.Block && block==null)db.UserBlocks.Add(new UserBlock{BlockerId=Caller,BlockedId=other});
        if(!input.Block && block!=null)db.UserBlocks.Remove(block);
        try{await db.SaveChangesAsync(ct);}catch(DbUpdateException){return Conflict();}return NoContent();
    }
    [HttpGet("{id:guid}/visits")] public async Task<IActionResult> Visits(Guid id,CancellationToken ct)
    {
        if(await Anchor(id,ct)==null)return NotFound();
        var rows=await db.ConversationVisits.AsNoTracking().Where(v=>v.ConversationId==id && (v.ParticipantA==Caller || v.ParticipantB==Caller))
            .OrderByDescending(v=>v.UpdatedAt).Take(30).ToListAsync(ct);
        return Ok(rows.Select(v=>VisitDto(v)));
    }
    public record VisitInput(string Action, DateTime? StartsAt, Guid? Revision);
    [HttpPost("{id:guid}/visits")] public async Task<IActionResult> Propose(Guid id,VisitInput input,CancellationToken ct) => await ChangeVisit(id,null,input,ct);
    [HttpPost("{id:guid}/visits/{visitId:guid}")] public async Task<IActionResult> UpdateVisit(Guid id,Guid visitId,VisitInput input,CancellationToken ct) => await ChangeVisit(id,visitId,input,ct);
    private object VisitDto(ConversationVisit v)=>new{v.Id,v.StartsAt,v.Status,v.Revision,v.UpdatedAt,ProposedByMe=v.ProposedBy==Caller,Expired=v.StartsAt<=DateTime.UtcNow};
    private async Task<IActionResult> ChangeVisit(Guid id,Guid? visitId,VisitInput input,CancellationToken ct)
    {
        var a=await Anchor(id,ct);if(a==null)return NotFound();var other=Other(a);if(other==Caller)return BadRequest();
        var cancel=input.Action=="Cancel";
        if(!cancel && await Blocked(other,ct))return Conflict();
        if(!cancel && (a.ApartmentId==null || !await db.Apartments.AnyAsync(h=>h.ApartmentId==a.ApartmentId && (h.Status==ApartmentStatus.Available || h.Status==ApartmentStatus.Negotiating),ct)))return Conflict();
        var now=DateTime.UtcNow;
        ConversationVisit v;
        if(visitId==null)
        {
            if(input.Action!="Propose")return BadRequest();
            // Keep history, but release elapsed proposals before creating another active visit.
            var elapsed=await db.ConversationVisits.Where(v=>v.ConversationId==id && v.StartsAt<=now && (v.Status=="Pending" || v.Status=="Accepted")).ToListAsync(ct);
            foreach(var old in elapsed){old.Status=old.Status=="Accepted"?"Completed":"Expired";old.Revision=Guid.NewGuid();old.UpdatedAt=now;}
            if(elapsed.Count>0)await db.SaveChangesAsync(ct);
            if(await db.ConversationVisits.AnyAsync(v=>v.ConversationId==id && (v.Status=="Pending" || v.Status=="Accepted"),ct))return Conflict();
            v=new ConversationVisit{ConversationId=id,ParticipantA=Caller,ParticipantB=other,ProposedBy=Caller};db.ConversationVisits.Add(v);
        }
        else
        {
            v=(await db.ConversationVisits.SingleOrDefaultAsync(v=>v.Id==visitId && v.ConversationId==id && (v.ParticipantA==Caller || v.ParticipantB==Caller),ct))!;
            if(v==null)return NotFound();if(input.Revision!=v.Revision)return Conflict();
            if(v.Status!="Pending" && v.Status!="Accepted")return Conflict();
            if(!cancel && v.StartsAt<=now)return Conflict();
            switch(input.Action)
            {
                case "Accept": if(v.Status!="Pending" || v.ProposedBy==Caller)return Conflict();v.Status="Accepted";break;
                case "Decline": if(v.Status!="Pending" || v.ProposedBy==Caller)return Conflict();v.Status="Declined";break;
                case "Cancel":v.Status="Cancelled";break;
                case "Counter":v.Status="Pending";v.ProposedBy=Caller;break;
                default:return BadRequest();
            }
        }
        if(input.Action is "Propose" or "Counter")
        {
            if(input.StartsAt==null || input.StartsAt.Value.Kind!=DateTimeKind.Utc || input.StartsAt<=now || input.StartsAt>now.AddDays(180))return BadRequest();
            v.StartsAt=input.StartsAt.Value;
        }
        v.UpdatedAt=now;v.Revision=Guid.NewGuid();
        var recipient=await db.Users.AsNoTracking().FirstOrDefaultAsync(u=>u.UserId==other && !u.IsBlocked,ct);if(recipient==null)return NotFound();
        var meIsSender=a.SenderId==Caller;
        var notice=new Message{MessageId=Guid.NewGuid(),ConversationId=id,SenderId=Caller,OwnerId=other,ApartmentId=a.ApartmentId,ApartmentSnapshot=a.ApartmentSnapshot,
            SenderIsAnonymous=meIsSender?a.SenderIsAnonymous:a.RecipientIsAnonymous,RecipientIsAnonymous=meIsSender?a.RecipientIsAnonymous:a.SenderIsAnonymous,
            Content=VisitText(recipient.LanguagePreference,input.Action)+" · "+v.StartsAt.ToString("yyyy-MM-dd HH:mm 'UTC'"),CreatedAt=now};
        db.Messages.Add(notice);
        try{await db.SaveChangesAsync(ct);}catch(DbUpdateConcurrencyException){return Conflict();}catch(DbUpdateException){return Conflict();}
        await messages.NotifySavedMessageAsync(notice.MessageId,ct);return Ok(VisitDto(v));
    }
    private static string VisitText(string lang,string action) => (lang,action) switch {
        ("he","Accept")=>"מועד הביקור אושר",("he","Decline")=>"הצעת הביקור נדחתה",("he","Cancel")=>"הביקור בוטל",("he",_)=>"הוצע מועד לביקור בדירה",
        ("fr","Accept")=>"Visite confirmée",("fr","Decline")=>"Visite refusée",("fr","Cancel")=>"Visite annulée",("fr",_)=>"Nouvelle proposition de visite",
        ("es","Accept")=>"Visita confirmada",("es","Decline")=>"Visita rechazada",("es","Cancel")=>"Visita cancelada",("es",_)=>"Nueva propuesta de visita",
        (_,"Accept")=>"Visit confirmed",(_,"Decline")=>"Visit declined",(_,"Cancel")=>"Visit cancelled",_=>"New apartment visit proposal"};
}
