using System.Text.RegularExpressions;
namespace serverApi.Services.Implementations;

public static class PrivacyText
{
    // This reduces common direct identifiers; it cannot detect all personal/sensitive information.
    public static string Minimize(string text)
    {
        var value = Regex.Replace(text, @"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email]", RegexOptions.None, TimeSpan.FromMilliseconds(100));
        return Regex.Replace(value, @"(?<!\w)\+?\d[\d ()-]{7,}\d(?!\w)", "[phone]", RegexOptions.None, TimeSpan.FromMilliseconds(100));
    }
}
