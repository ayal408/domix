using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Services.Implementations;
namespace serverApi.Controllers;

[ApiController, AllowAnonymous]
public class MediaController(ApartmentContext db) : ControllerBase
{
    [HttpGet("/images/{**fileName}")]
    public async Task<IActionResult> Get(string fileName, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        var url = "/images/" + fileName;
        var path = PrivacyImages.LocalPath(url);
        if (path is null || !await db.ApartmentImages.AnyAsync(i => i.ImageUrl == url &&
            db.Apartments.Any(a => a.ApartmentId == i.ApartmentId &&
                db.Users.Any(u => u.UserId == a.UserId && !u.IsBlocked)), ct) || !System.IO.File.Exists(path)) return NotFound();
        try
        {
            await using var input = System.IO.File.OpenRead(path);
            return File(await PrivacyImages.SanitizeAsync(input, ct), "image/jpeg");
        }
        catch (IOException) { return NotFound(); }
        catch (ArgumentException) { return NotFound(); }
    }
}
