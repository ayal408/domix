using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using serverApi.Data;
using serverApi.Extensions;
using serverApi.Services.Implementations;

namespace serverApi.Controllers;

[ApiController, Authorize, Route("api/preferences/language")]
public class LanguagePreferenceController(ApartmentContext db) : ControllerBase
{
    [HttpPut]
    public async Task<IActionResult> Update(LanguagePreferenceRequest input, CancellationToken ct)
    {
        if (input.Language is not ("he" or "en" or "es" or "fr"))
            return BadRequest(new { code = "INVALID_REQUEST" });
        var user = await db.Users.FindAsync(new object[] { User.GetUserId() }, ct);
        if (user is null || user.IsBlocked) return Forbid();
        if (user.LanguagePreference != input.Language)
        {
            user.LanguagePreference = EmailText.Language(input.Language);
            await db.SaveChangesAsync(ct);
        }
        return Ok(new { language = user.LanguagePreference });
    }
}
public record LanguagePreferenceRequest(string Language);
