using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace serverApi.Services.Implementations;

/// <summary>Optional durable image uploads for hosts with an ephemeral filesystem.</summary>
public class CloudinaryImageStorage(HttpClient http, IConfiguration configuration)
{
    private string Cloud => configuration["Cloudinary:CloudName"] ?? "";
    private string Key => configuration["Cloudinary:ApiKey"] ?? "";
    private string Secret => configuration["Cloudinary:ApiSecret"] ?? "";
    public bool IsConfigured => !string.IsNullOrWhiteSpace(Cloud) && !string.IsNullOrWhiteSpace(Key) && !string.IsNullOrWhiteSpace(Secret);

    public void ValidateConfiguration()
    {
        if (!IsConfigured || !Regex.IsMatch(Cloud, "^[a-zA-Z0-9_-]+$"))
            throw new InvalidOperationException("Durable image storage requires Cloudinary cloud name, API key and API secret in runtime secrets.");
    }

    public async Task<string> Upload(IFormFile file, CancellationToken ct)
    {
        ValidateConfiguration();
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);
        var id = $"domix/{Guid.NewGuid():N}";
        var payload = $"public_id={id}&timestamp={timestamp}";
        var signature = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payload + Secret))).ToLowerInvariant();
        using var body = new MultipartFormDataContent();
        await using var stream = file.OpenReadStream();
        using var content = new StreamContent(stream);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        body.Add(content, "file", "image" + Path.GetExtension(file.FileName).ToLowerInvariant());
        body.Add(new StringContent(Key), "api_key");
        body.Add(new StringContent(timestamp), "timestamp");
        body.Add(new StringContent(id), "public_id");
        body.Add(new StringContent(signature), "signature");
        using var response = await http.PostAsync($"https://api.cloudinary.com/v1_1/{Cloud}/image/upload", body, ct);
        // Never forward a provider's response body, which can contain configuration details.
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException("Image storage is unavailable. Please try again later.");
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        if (!json.RootElement.TryGetProperty("secure_url", out var value) ||
            !Uri.TryCreate(value.GetString(), UriKind.Absolute, out var uri) || uri.Scheme != "https" ||
            uri.Host != "res.cloudinary.com" || !uri.AbsolutePath.StartsWith($"/{Cloud}/image/upload/", StringComparison.Ordinal))
            throw new InvalidOperationException("Image storage returned an invalid image URL.");
        return uri.AbsoluteUri;
    }
}
