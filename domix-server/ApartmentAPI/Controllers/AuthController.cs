using Microsoft.AspNetCore.Mvc;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IUserService _userService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(IUserService userService, ILogger<AuthController> logger)
        {
            _userService = userService;
            _logger = logger;
        }

        // ================= GET USER =================
        [HttpGet("{identifier}")]
        public async Task<IActionResult> GetUser(string identifier, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(identifier))
                return BadRequest("Identifier cannot be empty.");

            var userDto = await _userService.GetUserByIdentifierAsync(identifier, cancellationToken);

            if (userDto == null)
                return NotFound();

            return Ok(userDto);
        }

        // ================= REGISTER =================
        [HttpPost]
        public async Task<IActionResult> Register([FromBody] UserDto dto, CancellationToken cancellationToken)
        {
            if (dto == null)
                return BadRequest("Invalid request payload.");

            if (string.IsNullOrWhiteSpace(dto.UserName) || string.IsNullOrWhiteSpace(dto.RegistrationMethod))
                return BadRequest("Missing required fields: UserName or RegistrationMethod.");

            try
            {
                var result = await _userService.RegisterAsync(dto, cancellationToken);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during user registration.");
                return StatusCode(500, "Internal server error occurred during registration.");
            }
        }

        // ================= VERIFY PASSWORD =================
        /// <summary>
        /// Internal, service-to-service only: auth-server's sole way to check a
        /// password. The hash never leaves this service — only the outcome
        /// (and the profile, on success) does.
        /// </summary>
        [HttpPost("verify-password")]
        public async Task<IActionResult> VerifyPassword([FromBody] VerifyPasswordDto dto, CancellationToken cancellationToken)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.UserName) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest(new { code = "INVALID_REQUEST" });

            var result = await _userService.VerifyPasswordAsync(dto.UserName, dto.Password, cancellationToken);

            return result.Outcome switch
            {
                PasswordVerifyOutcome.Success => Ok(result.User),
                PasswordVerifyOutcome.UserNotFound => NotFound(new { code = "USER_NOT_FOUND" }),
                PasswordVerifyOutcome.NoPasswordAccount => BadRequest(new { code = "NO_PASSWORD_ACCOUNT" }),
                PasswordVerifyOutcome.InvalidPassword => Unauthorized(new { code = "INVALID_PASSWORD" }),
                _ => StatusCode(500),
            };
        }
    }
}