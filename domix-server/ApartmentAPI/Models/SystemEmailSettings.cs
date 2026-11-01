namespace serverApi.Models;

/// <summary>One system-wide sender. OAuth secrets are encrypted before persistence.</summary>
public class SystemEmailSettings
{
    public int Id { get; set; } = 1;
    public string Provider { get; set; } = "gmail";
    public string SenderName { get; set; } = "DOMIX";
    public string Email { get; set; } = "";
    public string ReplyTo { get; set; } = "";
    public string Signature { get; set; } = "";
    public string TestSubject { get; set; } = "בדיקת מערכת DOMIX";
    public string TestBody { get; set; } = "זוהי הודעת בדיקה ממערכת DOMIX.";
    public string? GoogleClientId { get; set; }
    public string? ProtectedGoogleClientSecret { get; set; }
    public string? ProtectedRefreshToken { get; set; }
    public bool Enabled { get; set; } = true;
    public string ConnectionStatus { get; set; } = "configured";
    public DateTime? LastCheckedAt { get; set; }
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
