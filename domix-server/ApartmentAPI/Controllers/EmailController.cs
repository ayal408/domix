using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Extensions;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;

namespace serverApi.Controllers;

[ApiController]
[Route("api/email")]
[Authorize(Policy = "AdminOnly")]
public class EmailController(
    IEmailService emailService, EmailConfigurationService settings,
    GmailConnectionService connection, OutlookConnectionService outlook, ApartmentContext db, ILogger<EmailController> logger) : ControllerBase
{
    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings(CancellationToken ct)
    {
        var value = await settings.GetAsync(ct);
        return Ok(new
        {
            provider = value.Provider, outlookOAuthAvailable = outlook.Available, senderEmail = value.Email, value.SenderName, value.ReplyTo, value.Signature,
            value.TestSubject, value.TestBody, value.Enabled, value.UpdatedAt,
            connectionStatus = value.Enabled ? value.ConnectionStatus : "disconnected", value.LastCheckedAt,
            connected = await settings.IsConnectedAsync(ct), oauthAvailable = settings.OAuthAvailable
        });
    }

    [HttpPut("settings")]
    public async Task<IActionResult> SaveSettings(EmailSettingsRequest input, CancellationToken ct)
    {
        var value = await settings.GetAsync(ct);
        value.SenderName = input.SenderName.Trim();
        value.ReplyTo = input.ReplyTo?.Trim() ?? "";
        value.Signature = input.Signature?.Trim() ?? "";
        value.TestSubject = input.TestSubject.Trim();
        value.TestBody = input.TestBody.Trim();
        if (string.IsNullOrWhiteSpace(value.SenderName) || string.IsNullOrWhiteSpace(value.TestSubject)
            || string.IsNullOrWhiteSpace(value.TestBody) || value.SenderName.Any(char.IsControl)
            || (!string.IsNullOrEmpty(value.ReplyTo) && !EmailService.IsMailbox(value.ReplyTo)))
            return BadRequest(new { code = "EMAIL_INVALID_SETTINGS" });
        await settings.SaveAsync(value, ct);
        return await GetSettings(ct);
    }

    [HttpPost("gmail/connect")]
    public IActionResult Connect()
    {
        if (!settings.OAuthAvailable) return Conflict(new { code = "EMAIL_NOT_CONFIGURED" });
        return Ok(new { authorizationUrl = connection.Start(User.GetUserId()) });
    }

    [AllowAnonymous]
    [HttpGet("gmail/callback")]
    public async Task<IActionResult> Callback([FromQuery] string? state, [FromQuery] string? code,
        [FromQuery] string? error, CancellationToken ct)
    {
        var pending = connection.Consume(state);
        var result = "failed";
        if (pending is not null && string.IsNullOrEmpty(error) && !string.IsNullOrWhiteSpace(code))
        {
            // AdminOnly checked at initiation; recheck it after the external consent screen too.
            var admin = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.UserId == pending.AdminId, ct);
            if (admin?.Role == "Admin" && !admin.IsBlocked)
            {
                try
                {
                    var account = await connection.CompleteAsync(pending, code, ct);
                    await settings.ConnectAsync(account.Email, account.RefreshToken, ct);
                    await db.SavedSearchEmails.Where(x => x.Status == "Blocked")
                        .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "Pending").SetProperty(x => x.FailureCode, (string?)null), ct);
                    result = "connected";
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // Never write authorization codes or provider token responses to logs.
                    logger.LogWarning("Gmail consent could not be completed ({FailureType}).", ex.GetType().Name);
                }
            }
        }
        return Redirect(connection.ClientUrl + "/admin/email?gmail=" + result);
    }

    [HttpPost("outlook/connect")]
    public IActionResult ConnectOutlook()
    {
        if (!outlook.Available) return Conflict(new { code = "EMAIL_NOT_CONFIGURED" });
        return Ok(new { authorizationUrl = outlook.Start(User.GetUserId()) });
    }

    [AllowAnonymous]
    [HttpGet("outlook/callback")]
    public async Task<IActionResult> OutlookCallback([FromQuery] string? state, [FromQuery] string? code,
        [FromQuery] string? error, CancellationToken ct)
    {
        var pending = outlook.Consume(state);
        var result = "failed";
        if (pending is not null && string.IsNullOrEmpty(error) && !string.IsNullOrWhiteSpace(code))
        {
            var admin = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.UserId == pending.AdminId, ct);
            if (admin?.Role == "Admin" && !admin.IsBlocked)
            {
                try
                {
                    var account = await outlook.CompleteAsync(pending, code, ct);
                    await settings.ConnectOutlookAsync(account.Email, account.RefreshToken, ct);
                    await db.SavedSearchEmails.Where(x => x.Status == "Blocked")
                        .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "Pending").SetProperty(x => x.FailureCode, (string?)null), ct);
                    result = "connected";
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                { logger.LogWarning("Microsoft mail consent failed ({FailureType}).", ex.GetType().Name); }
            }
        }
        return Redirect(outlook.ClientUrl + "/admin/email?outlook=" + result);
    }

    [HttpDelete("gmail/connection")]
    [HttpDelete("connection")]
    public async Task<IActionResult> Disconnect(CancellationToken ct)
    {
        await settings.DisconnectAsync(ct);
        return NoContent();
    }

    [HttpPost("send-test")]
    public async Task<IActionResult> SendTestEmail(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] TestEmailRequest? input, CancellationToken ct)
    {
        try
        {
            await emailService.SendTestEmailAsync(input?.Recipient, ct);
            return Ok(new { sent = true });
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            logger.LogWarning("Email test failed ({FailureType}).", ex.GetType().Name);
            return StatusCode(502, new { code = ex is GmailReconnectRequiredException ? "EMAIL_RECONNECT_REQUIRED" : ex is InvalidOperationException ? "EMAIL_NOT_CONFIGURED" : "EMAIL_SEND_FAILED" });
        }
    }

    [HttpGet("outbox")]
    public async Task<IActionResult> Outbox(CancellationToken ct) => Ok(await db.SavedSearchEmails.AsNoTracking()
        .OrderByDescending(x => x.CreatedAt).Take(50)
        .Select(x => new { x.Id, x.Recipient, x.Subject, x.Status, x.FailureCode, x.CreatedAt }).ToListAsync(ct));

    [HttpGet("history")]
    public async Task<IActionResult> History(CancellationToken ct) => Ok(await db.EmailDeliveries.AsNoTracking()
        .OrderByDescending(x => x.CreatedAt).Take(50)
        .Select(x => new { x.Id, x.Recipient, x.Subject, x.Succeeded, x.FailureCode, x.CreatedAt }).ToListAsync(ct));
}

public class EmailSettingsRequest
{
    [Required, StringLength(100)] public string SenderName { get; set; } = "";
    [StringLength(254)] public string? ReplyTo { get; set; }
    [StringLength(2000)] public string? Signature { get; set; }
    [Required, StringLength(200)] public string TestSubject { get; set; } = "";
    [Required, StringLength(5000)] public string TestBody { get; set; } = "";
}

public class TestEmailRequest
{
    [Required, EmailAddress, StringLength(254)] public string Recipient { get; set; } = "";
}
