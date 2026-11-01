using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using serverApi.Extensions;
using serverApi.Services.Implementations;

namespace serverApi.Controllers;

[ApiController]
[Authorize]
[Route("api/activity")]
public sealed class ActivityController(ActivityTracker tracker) : ControllerBase
{
    [HttpPost("heartbeat")]
    public IActionResult Heartbeat()
    {
        var count = tracker.Touch(User.GetUserId());
        int? visibleCount = User.IsInRole("Admin") || User.IsInRole("Manager") ? count : null;
        return Ok(new { activeUserCount = visibleCount });
    }
}
