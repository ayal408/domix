using System.Security.Cryptography;
using System.Text;

namespace serverApi.Services.Implementations;

/// <summary>Uses a purpose-separated key derived from the existing server JWT secret.</summary>
public sealed class GmailTokenProtector
{
    private readonly byte[] _key;
    public GmailTokenProtector(string serverSecret)
    {
        if (serverSecret.Length < 32) throw new ArgumentException("Server secret is too short.");
        _key = HMACSHA256.HashData(Encoding.UTF8.GetBytes(serverSecret),
            Encoding.UTF8.GetBytes("DOMIX:GmailRefreshToken:v1"));
    }
    public string Protect(string token)
    {
        var plain = Encoding.UTF8.GetBytes(token);
        var nonce = RandomNumberGenerator.GetBytes(12);
        var encrypted = new byte[plain.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(_key, 16);
        aes.Encrypt(nonce, plain, encrypted, tag);
        CryptographicOperations.ZeroMemory(plain);
        return Convert.ToBase64String(nonce.Concat(tag).Concat(encrypted).ToArray());
    }
    public string Unprotect(string token)
    {
        var data = Convert.FromBase64String(token);
        if (data.Length < 28) throw new CryptographicException("Invalid protected token.");
        var plain = new byte[data.Length - 28];
        using var aes = new AesGcm(_key, 16);
        aes.Decrypt(data.AsSpan(0, 12), data.AsSpan(28), data.AsSpan(12, 16), plain);
        try { return Encoding.UTF8.GetString(plain); }
        finally { CryptographicOperations.ZeroMemory(plain); }
    }
}
