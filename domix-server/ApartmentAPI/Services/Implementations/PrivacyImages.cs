using SkiaSharp;
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
            using var input = new MemoryStream();
            await source.CopyToAsync(input, ct);
            using var data = SKData.CreateCopy(input.ToArray());
            using var codec = SKCodec.Create(data);
            if (codec is null || codec.Info.Width <= 0 || codec.Info.Height <= 0 ||
                (long)codec.Info.Width * codec.Info.Height > 16_000_000 || codec.FrameCount > 1)
                throw new ArgumentException("התמונה גדולה מדי או אינה תקינה");
            var info = new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Premul);
            using var bitmap = new SKBitmap(info);
            if (codec.GetPixels(info, bitmap.GetPixels()) != SKCodecResult.Success)
                throw new ArgumentException("התמונה אינה תקינה");
            ct.ThrowIfCancellationRequested();
            var width = info.Width; var height = info.Height;
            var swap = (int)codec.EncodedOrigin >= 5;
            using var surface = SKSurface.Create(new SKImageInfo(swap ? height : width, swap ? width : height));
            surface.Canvas.Clear(SKColors.White);
            // Apply orientation to pixels before re-encoding; no source EXIF/XMP/IPTC/ICC is copied.
            surface.Canvas.SetMatrix(Orientation(codec.EncodedOrigin, width, height));
            using var decoded = SKImage.FromBitmap(bitmap);
            surface.Canvas.DrawImage(decoded, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest, SKMipmapMode.None));
            using var image = surface.Snapshot();
            using var encoded = image.Encode(SKEncodedImageFormat.Jpeg, 85);
            return encoded.ToArray();
        }
        catch (InvalidOperationException) { throw new ArgumentException("התמונה אינה תקינה"); }
    }

    private static SKMatrix Orientation(SKEncodedOrigin origin, int width, int height)
    {
        var (sx, kx, tx, ky, sy, ty) = origin switch
        {
            SKEncodedOrigin.TopRight => (-1f, 0f, (float)width, 0f, 1f, 0f),
            SKEncodedOrigin.BottomRight => (-1f, 0f, (float)width, 0f, -1f, (float)height),
            SKEncodedOrigin.BottomLeft => (1f, 0f, 0f, 0f, -1f, (float)height),
            SKEncodedOrigin.LeftTop => (0f, 1f, 0f, 1f, 0f, 0f),
            SKEncodedOrigin.RightTop => (0f, -1f, (float)height, 1f, 0f, 0f),
            SKEncodedOrigin.RightBottom => (0f, -1f, (float)height, -1f, 0f, (float)width),
            SKEncodedOrigin.LeftBottom => (0f, 1f, 0f, -1f, 0f, (float)width),
            _ => (1f, 0f, 0f, 0f, 1f, 0f),
        };
        return new SKMatrix { ScaleX = sx, SkewX = kx, TransX = tx, SkewY = ky, ScaleY = sy, TransY = ty, Persp2 = 1 };

    }
}
