namespace serverApi.Models;

/// <summary>One system-wide sender. OAuth client keys remain in server configuration.</summary>
public class SystemEmailSettings
{
    public int Id { get; set; } = 1;
    public string SenderName { get; set; } = "DOMIX";
    public string Email { get; set; } = "";
    public string ReplyTo { get; set; } = "";
    public string Signature { get; set; } = "";
    public string TestSubject { get; set; } = "בדיקת מערכת DOMIX";
    public string TestBody { get; set; } = "זוהי הודעת בדיקה ממערכת DOMIX.";
    public string? ProtectedRefreshToken { get; set; }
    public bool Enabled { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class EmailDelivery
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Recipient { get; set; } = "";
    public string Subject { get; set; } = "";
    public bool Succeeded { get; set; }
    public string? FailureCode { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
