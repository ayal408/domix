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
                PasswordVerifyOutcome.Blocked => StatusCode(StatusCodes.Status403Forbidden, new { code = "ACCOUNT_BLOCKED" }),
                _ => StatusCode(500),
            };
        }

        // ================= VERIFY EMAIL =================
        [HttpPost("verify-email")]
        public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailDto dto, CancellationToken cancellationToken)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Token))
                return BadRequest(new { code = "INVALID_REQUEST" });

            var verified = await _userService.VerifyEmailAsync(dto.Token, cancellationToken);
            return verified ? Ok() : BadRequest(new { code = "INVALID_OR_EXPIRED_TOKEN" });
        }

        // ================= RESEND VERIFICATION =================
        [HttpPost("resend-verification")]
        public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationEmailDto dto, CancellationToken cancellationToken)
        {
            if (dto == null || dto.UserId == Guid.Empty)
                return BadRequest(new { code = "INVALID_REQUEST" });

            var sent = await _userService.ResendVerificationEmailAsync(dto.UserId, cancellationToken);
            return sent ? Ok() : BadRequest(new { code = "ALREADY_VERIFIED_OR_NOT_FOUND" });
        }

        // ================= FORGOT PASSWORD =================
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto, CancellationToken cancellationToken)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Email))
                return BadRequest(new { code = "INVALID_REQUEST" });

            // Always 200 regardless of whether the email matches an account — see
            // UserService.RequestPasswordResetAsync.
            await _userService.RequestPasswordResetAsync(dto.Email, cancellationToken);
            return Ok();
        }

        // ================= RESET PASSWORD =================
        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto, CancellationToken cancellationToken)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Token) || string.IsNullOrWhiteSpace(dto.PasswordHash))
                return BadRequest(new { code = "INVALID_REQUEST" });

            var reset = await _userService.ResetPasswordAsync(dto.Token, dto.PasswordHash, cancellationToken);
            return reset ? Ok() : BadRequest(new { code = "INVALID_OR_EXPIRED_TOKEN" });
        }
    }
}