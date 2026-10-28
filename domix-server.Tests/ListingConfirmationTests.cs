using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Controllers;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;

namespace domix_server.Tests;
public class ListingConfirmationTests
{
    private sealed class Geo : IGeocodingService
    {
        public Task<(double? Latitude, double? Longitude)> GetCoordinatesAsync(string city, string address, CancellationToken ct = default) => Task.FromResult<(double?, double?)>((null, null));
    }
    private static ApartmentContext Db() => new(new DbContextOptionsBuilder<ApartmentContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static CommunityController Controller(ApartmentContext db, Guid caller) => new(db)
    {
        ControllerContext = new() { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("userId", caller.ToString()) }, "test")) } }
    };
    [Fact]
    public async Task PublishAndEditDoNotInventAnAvailabilityConfirmation()
    {
        await using var db = Db(); var owner = Guid.NewGuid();
        var service = new ApartmentService(db, new Geo(), NullLogger<ApartmentService>.Instance);
        var home = await service.CreateApartmentAsync(new CreateApartmentDTO { city = "Haifa", address = "Street", price = 4000, ListingType = "Rent" }, owner);
        Assert.Null(home.LastConfirmedAt);
        var updated = await service.UpdateApartmentAsync(home.ApartmentId, new UpdateApartmentDTO { city = "Haifa", address = "Street", price = 4200, ListingType = "Rent" }, owner, false);
        Assert.Null(updated!.LastConfirmedAt);
    }
    [Fact]
    public async Task OnlyOwnerCanConfirmAndSnoozingDoesNotConfirm()
    {
        await using var db = Db(); var home = new Apartment { UserId = Guid.NewGuid(), IsAnonymous = true, city = "Haifa", address = "Private street" };
        db.Apartments.Add(home); await db.SaveChangesAsync();
        Assert.IsType<NotFoundResult>(await Controller(db, Guid.NewGuid()).Renew(home.ApartmentId, new(false), default));
        Assert.Null(home.LastConfirmedAt);
        var controller = Controller(db, home.UserId);
        Assert.IsType<NoContentResult>(await controller.Renew(home.ApartmentId, new(true), default));
        Assert.Null(home.LastConfirmedAt);
        var before = DateTime.UtcNow;
        Assert.IsType<NoContentResult>(await controller.Renew(home.ApartmentId, new(false), default));
        Assert.InRange(home.LastConfirmedAt!.Value, before, DateTime.UtcNow);
        var dto = ApartmentService.ToDTO(home);
        Assert.Equal(home.LastConfirmedAt, dto.LastConfirmedAt); Assert.Equal(Guid.Empty, dto.UserId); Assert.DoesNotContain("Private", dto.address);
    }
    [Theory]
    [InlineData(ApartmentStatus.Rented)]
    [InlineData(ApartmentStatus.Sold)]
    public async Task ClosingThenReopeningDoesNotReuseThePreviousConfirmation(ApartmentStatus closed)
    {
        await using var db = Db(); var home = new Apartment { UserId = Guid.NewGuid(), LastConfirmedAt = DateTime.UtcNow };
        db.Apartments.Add(home); await db.SaveChangesAsync();
        var service = new ApartmentService(db, new Geo(), NullLogger<ApartmentService>.Instance);
        await service.SetApartmentStatusAsync(home.ApartmentId, closed, home.UserId, false);
        Assert.Null(home.LastConfirmedAt);
        Assert.IsType<ConflictResult>(await Controller(db, home.UserId).Renew(home.ApartmentId, new(false), default));
        await service.SetApartmentStatusAsync(home.ApartmentId, ApartmentStatus.Available, home.UserId, false);
        Assert.Null((await service.GetApartmentByIdAsync(home.ApartmentId))!.LastConfirmedAt);
    }
}
