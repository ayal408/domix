using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
namespace serverApi.Services.Implementations;

public static class PrivacyImages
{
    public static async Task<string?> AvatarAsync(byte[]? bytes, CancellationToken ct)
    {
        if (bytes is null) return null;
        try { using var input = new MemoryStream(bytes); return Convert.ToBase64String(await SanitizeAsync(input, ct)); }
        catch (ArgumentException) { return null; }
    }

    public static string? LocalPath(string url)
    {
        if (!url.StartsWith("/images/", StringComparison.Ordinal) || url.Contains('\\') || url.Contains('%')) return null;
        var parts = url[8..].Split('/');
        if (parts.Length is < 1 or > 2 || parts.Any(p => p.Length == 0 || p is "." or "..")) return null;
        if (parts.Length == 2 && parts[0] != "apartments") return null;
        var name = parts[^1];
        if (!Guid.TryParse(Path.GetFileNameWithoutExtension(name), out _) ||
            !new[] { ".jpg", ".jpeg", ".png", ".webp" }.Contains(Path.GetExtension(name).ToLowerInvariant())) return null;
        return Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "images", Path.Combine(parts));
    }

    public static async Task<byte[]> SanitizeAsync(Stream source, CancellationToken ct)
    {
        try
        {
            if (!source.CanSeek || source.Length > 10 * 1024 * 1024) throw new ArgumentException("התמונה גדולה מדי");
            var header = new byte[21];
            var read = await source.ReadAsync(header, ct); source.Position = 0;
            var jpeg = read >= 3 && header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff;
            var png = read >= 8 && header.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
            var webp = read >= 12 && header.AsSpan(0, 4).SequenceEqual("RIFF"u8) && header.AsSpan(8, 4).SequenceEqual("WEBP"u8);
            if (!jpeg && !png && !webp) throw new ArgumentException("התמונה אינה בפורמט נתמך");
            if (webp && read >= 21 && header.AsSpan(12, 4).SequenceEqual("VP8X"u8) && (header[20] & 2) != 0)
                throw new ArgumentException("יש להעלות תמונה ללא הנפשה");
            var info = await Image.IdentifyAsync(source, ct);
            if (info is null || (long)info.Width * info.Height > 16_000_000)
                throw new ArgumentException("התמונה גדולה מדי או אינה תקינה");
            source.Position = 0;
            using var image = await Image.LoadAsync(source, ct);
            image.Mutate(x => x.AutoOrient());
            image.Metadata.ExifProfile = null; image.Metadata.IccProfile = null;
            image.Metadata.IptcProfile = null; image.Metadata.XmpProfile = null;
            foreach (var frame in image.Frames)
            {
                frame.Metadata.ExifProfile = null; frame.Metadata.XmpProfile = null;
            }
            using var output = new MemoryStream();
            await image.SaveAsJpegAsync(output, new JpegEncoder { Quality = 85 }, ct);
            return output.ToArray();
        }
        catch (UnknownImageFormatException) { throw new ArgumentException("התמונה אינה תקינה"); }
        catch (InvalidImageContentException) { throw new ArgumentException("התמונה אינה תקינה"); }
    }
}
