using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Models;
namespace serverApi.Controllers;
[ApiController, Route("api/return-tools"), Authorize]
public class ReturnToolsController(ApartmentContext db):ControllerBase
{
    private Guid Caller=>Guid.Parse(User.FindFirst("userId")?.Value??User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    [HttpGet("alerts")]public async Task<IActionResult> Alerts(CancellationToken ct)=>Ok(await db.SavedSearchEmails.AsNoTracking()
        .Where(e=>e.SavedSearch.UserId==Caller && e.SiteVisible && e.MatchCount>0).OrderByDescending(e=>e.CreatedAt).Take(30)
        .Select(e=>new{e.Id,e.SavedSearchId,Name=e.SavedSearch.Name,e.MatchCount,e.CreatedAt,e.SeenAt}).ToListAsync(ct));
    [HttpPost("alerts/{id:guid}/seen")]public async Task<IActionResult> Seen(Guid id,CancellationToken ct)
    {var row=await db.SavedSearchEmails.SingleOrDefaultAsync(e=>e.Id==id && e.SavedSearch.UserId==Caller,ct);if(row==null)return NotFound();row.SeenAt??=DateTime.UtcNow;await db.SaveChangesAsync(ct);return NoContent();}
    public record ChannelInput(string Channel);
    [HttpPost("searches/{id:guid}/channel")]public async Task<IActionResult> Channel(Guid id,ChannelInput input,CancellationToken ct)
    {if(!new[]{"Site","Email","Both","Off"}.Contains(input.Channel))return BadRequest();var s=await db.SavedSearches.SingleOrDefaultAsync(s=>s.SavedSearchId==id && s.UserId==Caller,ct);if(s==null)return NotFound();if(s.AlertChannel=="Off" && input.Channel!="Off")s.LastNotifiedAt=DateTime.UtcNow;s.AlertChannel=input.Channel;await db.SaveChangesAsync(ct);return NoContent();}
    [HttpGet("visits")]public async Task<IActionResult> Visits([FromQuery]DateTime from,[FromQuery]DateTime through,CancellationToken ct)
    {
        if(from.Kind!=DateTimeKind.Utc || through.Kind!=DateTimeKind.Utc || through<=from || through>from.AddDays(93))return BadRequest();
        var rows=await db.ConversationVisits.AsNoTracking().Where(v=>(v.ParticipantA==Caller || v.ParticipantB==Caller) && v.StartsAt>=from && v.StartsAt<through)
            .OrderBy(v=>v.StartsAt).Take(300).ToListAsync(ct);
        return Ok(rows.Select(v=>VisitDto(v)));
    }
    [HttpGet("visit-reminders")]public async Task<IActionResult> Reminders(CancellationToken ct)
    {var now=DateTime.UtcNow;var until=now.AddHours(24);return Ok(await db.ConversationVisits.AsNoTracking().Where(v=>v.Status=="Accepted" && v.StartsAt>now && v.StartsAt<=until &&
        ((v.ParticipantA==Caller && v.ReminderDismissedARevision!=v.Revision)||(v.ParticipantB==Caller && v.ReminderDismissedBRevision!=v.Revision)))
        .OrderBy(v=>v.StartsAt).Take(30).Select(v=>new{v.Id,v.ConversationId,v.StartsAt}).ToListAsync(ct));}
    public record ReminderInput(bool Enabled,Guid Revision);
    [HttpPost("visits/{id:guid}/reminder")]public async Task<IActionResult> Reminder(Guid id,ReminderInput input,CancellationToken ct)
    {var v=await db.ConversationVisits.SingleOrDefaultAsync(v=>v.Id==id && (v.ParticipantA==Caller || v.ParticipantB==Caller),ct);if(v==null)return NotFound();if(v.Revision!=input.Revision)return Conflict();if(v.ParticipantA==Caller)v.ReminderDismissedARevision=input.Enabled?null:v.Revision;else v.ReminderDismissedBRevision=input.Enabled?null:v.Revision;try{await db.SaveChangesAsync(ct);}catch(DbUpdateConcurrencyException){return Conflict();}return NoContent();}
    private object VisitDto(ConversationVisit v)=>new{v.Id,v.ConversationId,v.StartsAt,v.Status,v.Revision,v.UpdatedAt,ProposedByMe=v.ProposedBy==Caller,ReminderEnabled=(v.ParticipantA==Caller?v.ReminderDismissedARevision:v.ReminderDismissedBRevision)!=v.Revision};
    private IQueryable<Message> OwnLeads()=>db.Messages.AsNoTracking().Where(m=>!m.IsDeleted && m.ApartmentId!=null && db.Apartments.IgnoreQueryFilters().Any(a=>a.ApartmentId==m.ApartmentId && a.UserId==Caller) && (m.SenderId==Caller || m.OwnerId==Caller));
    [HttpGet("leads")]public async Task<IActionResult> Leads([FromQuery]int offset=0,CancellationToken ct=default)
    {
        var summary=await OwnLeads().GroupBy(m=>m.ConversationId).Select(g=>new{Id=g.Key,LastAt=g.Max(m=>m.CreatedAt)})
            .OrderByDescending(g=>g.LastAt).ThenBy(g=>g.Id).Skip(Math.Clamp(offset,0,100000)).Take(30).ToListAsync(ct);
        var ids=summary.Select(g=>g.Id).ToList();
        var page=await OwnLeads().Where(m=>ids.Contains(m.ConversationId)).GroupBy(m=>m.ConversationId).Select(g=>g.OrderByDescending(m=>m.CreatedAt).ThenByDescending(m=>m.MessageId).First()).ToListAsync(ct);
        var states=await db.ConversationLeads.AsNoTracking().Where(l=>l.OwnerId==Caller && ids.Contains(l.ConversationId)).ToDictionaryAsync(l=>l.ConversationId,ct);
        var people=page.Select(m=>m.SenderId==Caller?m.OwnerId:m.SenderId).Distinct().ToList();
        var names=await db.Users.AsNoTracking().Where(u=>people.Contains(u.UserId)).ToDictionaryAsync(u=>u.UserId,u=>u.UserName,ct);
        return Ok(summary.Select(g=>{var m=page.Single(m=>m.ConversationId==g.Id);states.TryGetValue(m.ConversationId,out var state);var anon=m.SenderId==Caller?m.RecipientIsAnonymous:m.SenderIsAnonymous;var other=m.SenderId==Caller?m.OwnerId:m.SenderId;return new{m.ConversationId,m.ApartmentId,m.ApartmentSnapshot,LastAt=m.CreatedAt,Status=state?.Status??"New",Revision=state?.Revision,PersonName=anon?null:names.GetValueOrDefault(other)};}));
    }
    public record LeadInput(string Status,Guid? Revision);
    [HttpPost("leads/{id:guid}")]public async Task<IActionResult> Lead(Guid id,LeadInput input,CancellationToken ct)
    {
        if(!new[]{"New","InProgress","NotRelevant"}.Contains(input.Status))return BadRequest();if(!await OwnLeads().AnyAsync(m=>m.ConversationId==id,ct))return NotFound();
        var row=await db.ConversationLeads.SingleOrDefaultAsync(l=>l.ConversationId==id && l.OwnerId==Caller,ct);
        if(row==null){if(input.Revision.HasValue)return Conflict();row=new ConversationLead{ConversationId=id,OwnerId=Caller};db.ConversationLeads.Add(row);}else if(row.Revision!=input.Revision)return Conflict();
        row.Status=input.Status;row.UpdatedAt=DateTime.UtcNow;row.Revision=Guid.NewGuid();try{await db.SaveChangesAsync(ct);}catch(DbUpdateConcurrencyException){return Conflict();}catch(DbUpdateException){return Conflict();}return NoContent();
    }
}
