namespace serverApi.Services.Interfaces
{
    public interface IEmailService
    {
        Task SendTestEmailAsync(string? recipientEmail = null, CancellationToken cancellationToken = default);
        Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default);
    }
}
