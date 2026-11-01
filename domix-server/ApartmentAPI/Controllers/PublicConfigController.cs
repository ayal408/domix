using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using serverApi.Services.Implementations;

namespace serverApi.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/config")]
public sealed class PublicConfigController(EmailConfigurationService emailConfiguration) : ControllerBase
{
    [HttpGet("google")]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> GetGoogle(CancellationToken ct)
    {
        var oauth = await emailConfiguration.GetOAuthSummaryAsync(ct);
        return Ok(new { clientId = oauth.ClientId ?? string.Empty });
    }
}
