using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;

namespace domix_server.Tests;

public class ApartmentImageServiceTests
{
    private static ApartmentContext MakeContext()
    {
        var options = new DbContextOptionsBuilder<ApartmentContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApartmentContext(options);
    }

    /// <summary>A file whose bytes actually start with the JPEG magic number, padded to `length`
    /// -- required since UploadImageAsync now checks real file content, not just the extension.</summary>
    private static IFormFile MakeFormFile(long length, string fileName = "photo.jpg")
    {
        using var picture = new SkiaSharp.SKBitmap(2, 2);
        using var image = SkiaSharp.SKImage.FromBitmap(picture);
        using var encoded = image.Encode(SkiaSharp.SKEncodedImageFormat.Jpeg, 90);
        var output = new MemoryStream(); encoded.SaveTo(output);
        if (length > output.Length) output.SetLength(length);
        output.Position = 0;
        return new FormFile(output, 0, output.Length, "Image", fileName);
    }

    private static IFormFile MakeFormFileWithBytes(byte[] bytes, string fileName = "photo.jpg")
    {
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "Image", fileName);
    }

    private static async Task<(ApartmentContext context, ApartmentImageService service, Guid apartmentId, Guid ownerId)> SetupAsync()
    {
        var context = MakeContext();
        var ownerId = Guid.NewGuid();
        var apartmentId = Guid.NewGuid();
        context.Apartments.Add(new Apartment { ApartmentId = apartmentId, city = "Tel Aviv", UserId = ownerId });
        await context.SaveChangesAsync();

        var service = new ApartmentImageService(context, NullLogger<ApartmentImageService>.Instance);
        return (context, service, apartmentId, ownerId);
    }

    [Fact]
    public async Task UploadImageAsync_RejectsFileOverTenMegabytes()
    {
        var (_, service, apartmentId, ownerId) = await SetupAsync();
        var dto = new UploadImageDto { ApartmentId = apartmentId, Image = MakeFormFile(10 * 1024 * 1024 + 1) };

        await Assert.ThrowsAsync<ArgumentException>(() => service.UploadImageAsync(dto, ownerId, isPrivileged: false));
    }

    [Fact]
    public async Task UploadImageAsync_AllowsFileAtExactlyTenMegabytes()
    {
        var (_, service, apartmentId, ownerId) = await SetupAsync();
        var dto = new UploadImageDto { ApartmentId = apartmentId, Image = MakeFormFile(10 * 1024 * 1024) };

        var result = await service.UploadImageAsync(dto, ownerId, isPrivileged: false);

        Assert.Equal(apartmentId, result.ApartmentId);
    }

    [Fact]
    public async Task UploadImageAsync_RejectsANonOwnerNonPrivilegedCaller()
    {
        var (_, service, apartmentId, _) = await SetupAsync();
        var strangerId = Guid.NewGuid();
        var dto = new UploadImageDto { ApartmentId = apartmentId, Image = MakeFormFile(1024) };

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.UploadImageAsync(dto, strangerId, isPrivileged: false));
    }

    [Fact]
    public async Task UploadImageAsync_AllowsAPrivilegedCallerWhoIsNotTheOwner()
    {
        var (_, service, apartmentId, _) = await SetupAsync();
        var adminId = Guid.NewGuid();
        var dto = new UploadImageDto { ApartmentId = apartmentId, Image = MakeFormFile(1024) };

        var result = await service.UploadImageAsync(dto, adminId, isPrivileged: true);

        Assert.Equal(apartmentId, result.ApartmentId);
    }

    [Fact]
    public async Task CreateImageAsync_RejectsANonOwnerNonPrivilegedCaller()
    {
        var (_, service, apartmentId, _) = await SetupAsync();
        var strangerId = Guid.NewGuid();
        var dto = new ApartmentImageDTO { ApartmentId = apartmentId, ImageUrl = "https://example.com/photo.jpg" };

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.CreateImageAsync(dto, strangerId, isPrivileged: false));
    }

    [Fact]
    public async Task CreateImageAsync_RejectsExternalImageUrlsEvenForOwner()
    {
        var (_, service, apartmentId, ownerId) = await SetupAsync();
        var dto = new ApartmentImageDTO { ApartmentId = apartmentId, ImageUrl = "https://example.com/photo.jpg" };

        await Assert.ThrowsAsync<ArgumentException>(() => service.CreateImageAsync(dto, ownerId, isPrivileged: false));
    }

    [Fact]
    public async Task UploadImageAsync_RejectsAFileWhoseContentDoesNotMatchItsExtension()
    {
        var (_, service, apartmentId, ownerId) = await SetupAsync();
        // ".jpg" filename, but the actual bytes are plain text -- e.g. a renamed script.
        var dto = new UploadImageDto
        {
            ApartmentId = apartmentId,
            Image = MakeFormFileWithBytes("<script>alert(1)</script>"u8.ToArray()),
        };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.UploadImageAsync(dto, ownerId, isPrivileged: false));
        Assert.Contains("don't match", ex.Message);
    }

    [Fact]
    public async Task UploadImageAsync_AcceptsARealPngRegardlessOfItsClaimedExtension()
    {
        var (_, service, apartmentId, ownerId) = await SetupAsync();
        using var png = new SkiaSharp.SKBitmap(2, 2);
        using var pngImage = SkiaSharp.SKImage.FromBitmap(png);
        using var encoded = pngImage.Encode(SkiaSharp.SKEncodedImageFormat.Png, 100);
        var pngHeader = encoded.ToArray();
        var dto = new UploadImageDto
        {
            ApartmentId = apartmentId,
            Image = MakeFormFileWithBytes(pngHeader, fileName: "photo.png"),
        };

        var result = await service.UploadImageAsync(dto, ownerId, isPrivileged: false);

        Assert.Equal(apartmentId, result.ApartmentId);
    }

    [Fact]
    public async Task UploadImageAsync_ThrowsKeyNotFoundForAMissingApartment()
    {
        var context = MakeContext();
        var service = new ApartmentImageService(context, NullLogger<ApartmentImageService>.Instance);
        var dto = new UploadImageDto { ApartmentId = Guid.NewGuid(), Image = MakeFormFile(1024) };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.UploadImageAsync(dto, Guid.NewGuid(), isPrivileged: false));
    }
}
