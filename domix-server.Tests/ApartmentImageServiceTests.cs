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

    private static IFormFile MakeFormFile(long length, string fileName = "photo.jpg")
    {
        var stream = new MemoryStream(new byte[length == 0 ? 0 : 1]);
        return new FormFile(stream, 0, length, "Image", fileName);
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
    public async Task CreateImageAsync_AllowsTheOwner()
    {
        var (_, service, apartmentId, ownerId) = await SetupAsync();
        var dto = new ApartmentImageDTO { ApartmentId = apartmentId, ImageUrl = "https://example.com/photo.jpg" };

        var result = await service.CreateImageAsync(dto, ownerId, isPrivileged: false);

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
