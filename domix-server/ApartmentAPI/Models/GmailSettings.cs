namespace serverApi.Models
{
    public class GmailSettings
    {
        public string Email { get; set; } = string.Empty;
        public string ClientId { get; set; } = string.Empty;
        public string ClientSecret { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
    }
}