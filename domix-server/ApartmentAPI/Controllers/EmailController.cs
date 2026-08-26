using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using serverApi.Services.Interfaces;

namespace serverApi.Controllers
{
    [ApiController]
    [Route("api/email")]
    [Authorize(Policy = "AdminOnly")] // אבטחה מחמירה - רק מנהלים יכולים להריץ בדיקות מערכת
    public class EmailController : ControllerBase
    {
        private readonly IEmailService _emailService;
        private readonly ILogger<EmailController> _logger;

        public EmailController(IEmailService emailService, ILogger<EmailController> logger)
        {
            _emailService = emailService;
            _logger = logger;
        }

        [HttpPost("send-test")]
        public async Task<IActionResult> SendTestEmail(CancellationToken cancellationToken)
        {
            // ניתן לקחת ברירת מחדל מהקונפיגורציה או להשתמש בכתובת קבועה
            var targetEmail = "tichnut92@8547900.org.il";

            try
            {
                await _emailService.SendTestEmailAsync(targetEmail, cancellationToken);
                _logger.LogInformation("Test email successfully triggered via API.");
                return Ok(new { message = "Test email sent successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send test email.");
                return StatusCode(500, "Internal server error occurred while sending email.");
            }
        }
    }
}