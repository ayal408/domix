
namespace serverApi.Dto
{
    public class RegisterDto
    {
        public string UserName { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? Password { get; set; }
        public string? GoogleId { get; set; }
    }
}