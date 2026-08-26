using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;
using System.Security.Claims;

namespace serverApi.Controllers
{
    [ApiController]
    [Route("api/User")]
    public class UserController : ControllerBase
    {
        private readonly IUserService _userService;
        private readonly ILogger<UserController> _logger;

        public UserController(IUserService userService, ILogger<UserController> logger)
        {
            _userService = userService;
            _logger = logger;
        }

        // ================= GET BY ID =================
        [HttpGet("by-id/{userId}")]
        public async Task<IActionResult> GetById(string userId, CancellationToken cancellationToken)
        {
            var user = await _userService.GetUserByIdAsync(userId, cancellationToken);
            return user == null ? NotFound() : Ok(user);
        }

        // ================= GET BY EMAIL =================
        [HttpGet("by-email/{email}")]
        public async Task<IActionResult> GetByEmail(string email, CancellationToken cancellationToken)
        {
            var user = await _userService.GetUserByEmailAsync(email, cancellationToken);
            return user == null ? NotFound() : Ok(user);
        }

        // ================= GET BY USERNAME =================
        [HttpGet("by-username/{username}")]
        public async Task<IActionResult> GetByUsername(string username, CancellationToken cancellationToken)
        {
            var user = await _userService.GetUserByUsernameAsync(username, cancellationToken);
            return user == null ? NotFound() : Ok(user);
        }

        // ================= GET BY GOOGLE ID =================
        [HttpGet("by-google-id/{googleId}")]
        public async Task<IActionResult> GetByGoogleId(string googleId, CancellationToken cancellationToken)
        {
            var user = await _userService.GetUserByGoogleIdAsync(googleId, cancellationToken);
            return user == null ? NotFound() : Ok(user);
        }

        // ================= CREATE USER =================
        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] UserDto user, CancellationToken cancellationToken)
        {
            if (user == null)
                return BadRequest("Invalid request payload.");

            try
            {
                var result = await _userService.CreateUserAsync(user, cancellationToken);
                return Ok(result);
            }
            catch (DbUpdateException)
            {
                return Conflict("Duplicate user (email/username/googleId)");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating user.");
                return StatusCode(500, "Internal server error.");
            }
        }

        // ================= LINK GOOGLE =================
        [HttpPut("link-google")]
        public async Task<IActionResult> LinkGoogle([FromBody] LinkGoogleDto dto, CancellationToken cancellationToken)
        {
            var user = await _userService.LinkGoogleAsync(dto, cancellationToken);
            if (user == null) return NotFound();

            return Ok(user);
        }

        // ================= LINK PASSWORD =================
        [HttpPut("link-password")]
        public async Task<IActionResult> LinkPassword([FromBody] LinkPasswordDto dto, CancellationToken cancellationToken)
        {
            var user = await _userService.LinkPasswordAsync(dto, cancellationToken);
            if (user == null) return NotFound();

            return Ok(user);
        }

        // ================= LOOKUP (UNIFIED) =================
        [HttpGet("lookup")]
        public async Task<IActionResult> Lookup([FromQuery] string? email, [FromQuery] string? username, [FromQuery] string? googleId, CancellationToken cancellationToken)
        {
            try
            {
                var userDto = await _userService.LookupUserAsync(email, username, googleId, cancellationToken);
                return userDto == null ? NotFound() : Ok(userDto);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message, stack = ex.StackTrace });
            }
        }

        // ================= UPDATE PROFILE IMAGE =================
        [Authorize]
        [HttpPut("profile-image")]
        public async Task<IActionResult> UpdateProfileImage([FromBody] UpdateProfileImageDto dto, CancellationToken cancellationToken)
        {
            if (dto == null || string.IsNullOrEmpty(dto.ProfileImage))
                return BadRequest(new { code = "Empty image" });

            // שליפת מזהה המשתמש מתוך ה-Claims המאומתים של ה-JWT Middleware (בטוח בהרבה מפענוח ידני)
            var userIdClaim = User.FindFirst("userId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { code = "Missing or invalid userId claim" });
            }

            try
            {
                var updatedUser = await _userService.UpdateProfileImageAsync(userId, dto.ProfileImage, cancellationToken);
                if (updatedUser == null)
                {
                    return BadRequest(new { code = "NO_CHANGE or Image did not actually change" });
                }

                return Ok(updatedUser);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { code = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update profile image.");
                return StatusCode(500, new { code = "Internal server error" });
            }
        }
    }
}