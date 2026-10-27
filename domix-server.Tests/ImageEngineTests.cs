using System.Text;
using SkiaSharp;
using serverApi.Services.Implementations;
namespace domix_server.Tests;

public class ImageEngineTests
{
    internal static byte[] JpegWithExif(int width, int height, ushort orientation)
    {
        using var bitmap = new SKBitmap(width, height);
        using var canvas = new SKCanvas(bitmap); canvas.Clear(SKColors.White);
        using var paint = new SKPaint { Color = SKColors.Red }; canvas.DrawRect(0, 0, width / 2f, height / 2f, paint);
        using var image = SKImage.FromBitmap(bitmap); using var jpeg = image.Encode(SKEncodedImageFormat.Jpeg, 100);
        // Little-endian TIFF header with orientation and an artist identifier inside a JPEG EXIF APP1 segment.
        using var metadata = new MemoryStream(); using var writer = new BinaryWriter(metadata, Encoding.ASCII, true);
        writer.Write("Exif\0\0"u8); writer.Write("II"u8); writer.Write((ushort)42); writer.Write(8u); writer.Write((ushort)2);
        writer.Write((ushort)0x0112); writer.Write((ushort)3); writer.Write(1u); writer.Write(orientation); writer.Write((ushort)0);
        var artist = Encoding.ASCII.GetBytes("Private owner\0");
        writer.Write((ushort)0x013b); writer.Write((ushort)2); writer.Write((uint)artist.Length); writer.Write(38u);
        writer.Write(0u); writer.Write(artist); writer.Flush();
        var payload = metadata.ToArray(); var original = jpeg.ToArray();
        return original[..2].Concat(new byte[] { 0xff, 0xe1, (byte)((payload.Length + 2) >> 8), (byte)(payload.Length + 2) })
            .Concat(payload).Concat(original[2..]).ToArray();
    }

    [Theory]
    [InlineData(1, 40, 20, 0, 0)] [InlineData(2, 40, 20, 1, 0)]
    [InlineData(3, 40, 20, 1, 1)] [InlineData(4, 40, 20, 0, 1)]
    [InlineData(5, 20, 40, 0, 0)] [InlineData(6, 20, 40, 1, 0)]
    [InlineData(7, 20, 40, 1, 1)] [InlineData(8, 20, 40, 0, 1)]
    public async Task AllExifOrientationsAreBakedIntoPixels_AndMetadataIsRemoved(ushort orientation, int width, int height, int redX, int redY)
    {
        using var source = new MemoryStream(JpegWithExif(40, 20, orientation));
        var result = await PrivacyImages.SanitizeAsync(source, default);
        using var bitmap = SKBitmap.Decode(result);
        Assert.Equal(width, bitmap.Width); Assert.Equal(height, bitmap.Height);
        var color = bitmap.GetPixel(redX == 0 ? width / 4 : 3 * width / 4, redY == 0 ? height / 4 : 3 * height / 4);
        Assert.True(color.Red > 180 && color.Green < 80 && color.Blue < 80, $"Orientation {orientation}: red patch was lost/misplaced");
        var text = Encoding.ASCII.GetString(result);
        Assert.DoesNotContain("Private owner", text); Assert.DoesNotContain("Exif", text);
        using var codec = SKCodec.Create(new MemoryStream(result)); Assert.Equal(SKEncodedOrigin.TopLeft, codec.EncodedOrigin);
    }

    [Theory]
    [InlineData(SKEncodedImageFormat.Png)] [InlineData(SKEncodedImageFormat.Jpeg)] [InlineData(SKEncodedImageFormat.Webp)]
    public async Task SupportedFormatsRoundTripWithExpectedDimensions(SKEncodedImageFormat format)
    {
        using var bitmap = new SKBitmap(23, 31); using var canvas = new SKCanvas(bitmap); canvas.Clear(SKColors.Blue);
        using var image = SKImage.FromBitmap(bitmap); using var encoded = image.Encode(format, 100);
        using var input = new MemoryStream(encoded.ToArray());
        using var sanitized = SKBitmap.Decode(await PrivacyImages.SanitizeAsync(input, default));
        Assert.Equal(23, sanitized.Width); Assert.Equal(31, sanitized.Height);
    }

    [Fact]
    public async Task DimensionAndCancellationGuardsRunBeforeLargeDecode()
    {
        using var bitmap = new SKBitmap(4001, 4000); using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(SKEncodedImageFormat.Png, 100);
        await Assert.ThrowsAsync<ArgumentException>(() => PrivacyImages.SanitizeAsync(new MemoryStream(encoded.ToArray()), default));
        using var cancelled = new CancellationTokenSource(); cancelled.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => PrivacyImages.SanitizeAsync(new MemoryStream(JpegWithExif(3, 5, 1)), cancelled.Token));
    }
}
