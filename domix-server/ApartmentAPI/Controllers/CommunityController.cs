using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Models;
namespace serverApi.Controllers;
[ApiController,Route("api/community"),Authorize]
public class CommunityController(ApartmentContext db):ControllerBase
{
    private Guid Caller=>Guid.Parse(User.FindFirst("userId")?.Value??User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public record ReportInput(Guid? MessageId,Guid? ApartmentId,[Required,StringLength(40)]string Reason,[StringLength(1000)]string? Details);
    [HttpPost("reports")]public async Task<IActionResult> Report(ReportInput input,CancellationToken ct)
    {
        if((input.MessageId==null)==(input.ApartmentId==null) || !new[]{"Spam","Harassment","Fraud","Inaccurate","Other"}.Contains(input.Reason))return BadRequest();
        if(input.MessageId.HasValue && !await db.Messages.AnyAsync(m=>m.MessageId==input.MessageId && m.OwnerId==Caller && !m.IsDeleted,ct))return NotFound();
        if(input.ApartmentId.HasValue && !await db.Apartments.AnyAsync(a=>a.ApartmentId==input.ApartmentId,ct))return NotFound();
        var cutoff=DateTime.UtcNow.AddDays(-1);
        if(await db.ListingReports.CountAsync(r=>r.ReporterId==Caller && r.CreatedAt>cutoff,ct)>=20)return StatusCode(429);
        if(await db.ListingReports.AnyAsync(r=>r.ReporterId==Caller && r.MessageId==input.MessageId && r.ApartmentId==input.ApartmentId && r.ReviewedAt==null,ct))return NoContent();
        db.ListingReports.Add(new ListingReport{ReporterId=Caller,MessageId=input.MessageId,ApartmentId=input.ApartmentId,Reason=input.Reason,Details=input.Details?.Trim()??""});await db.SaveChangesAsync(ct);return NoContent();
    }
    [HttpGet("reports"),Authorize(Policy="ManagerOrAdmin")]public async Task<IActionResult> Reports([FromQuery]int offset=0,CancellationToken ct=default)=>Ok(await db.ListingReports.AsNoTracking().OrderBy(r=>r.ReviewedAt!=null).ThenByDescending(r=>r.CreatedAt).Skip(Math.Clamp(offset,0,100000)).Take(30).ToListAsync(ct));
    [HttpPost("reports/{id:guid}/review"),Authorize(Policy="ManagerOrAdmin")]public async Task<IActionResult> Review(Guid id,CancellationToken ct)
    {var r=await db.ListingReports.FindAsync(new object[]{id},ct);if(r==null)return NotFound();if(r.ReviewedAt==null){r.ReviewedAt=DateTime.UtcNow;r.ReviewedBy=Caller;await db.SaveChangesAsync(ct);}return NoContent();}
    [HttpGet("renewals")]public async Task<IActionResult> Renewals(CancellationToken ct)
    {var now=DateTime.UtcNow;var cutoff=now.AddDays(-30);return Ok(await db.Apartments.AsNoTracking().Where(a=>a.UserId==Caller && (a.Status==ApartmentStatus.Available || a.Status==ApartmentStatus.Negotiating) && (a.LastConfirmedAt??a.dateInsert)<cutoff && (a.RenewalSnoozedUntil==null || a.RenewalSnoozedUntil<=now)).OrderBy(a=>a.LastConfirmedAt??a.dateInsert).Take(30).Select(a=>new{a.ApartmentId,a.city,a.area}).ToListAsync(ct));}
    public record RenewalInput(bool Snooze);
    [HttpPost("renewals/{id:guid}")]public async Task<IActionResult> Renew(Guid id,RenewalInput input,CancellationToken ct)
    {var a=await db.Apartments.SingleOrDefaultAsync(a=>a.ApartmentId==id && a.UserId==Caller,ct);if(a==null)return NotFound();if(a.Status!=ApartmentStatus.Available && a.Status!=ApartmentStatus.Negotiating)return Conflict();if(input.Snooze)a.RenewalSnoozedUntil=DateTime.UtcNow.AddDays(7);else{a.LastConfirmedAt=DateTime.UtcNow;a.RenewalSnoozedUntil=null;}await db.SaveChangesAsync(ct);return NoContent();}
}
