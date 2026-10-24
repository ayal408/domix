using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Controllers;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;

namespace domix_server.Tests;

public class ExchangeTests
{
    private readonly Guid owner = Guid.NewGuid();
    private static readonly DateOnly Start = ExchangeMatching.Today.AddDays(10);
    private static readonly DateOnly End = Start.AddDays(4);
    private static ApartmentContext Context() => new(new DbContextOptionsBuilder<ApartmentContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private Apartment Offer(string city = "חיפה", string desired = "ירושלים") => new()
    {
        ApartmentId = Guid.NewGuid(), UserId = owner, city = city, DesiredCity = desired,
        ListingType = "Exchange", AvailableFrom = Start, AvailableTo = End,
    };
    private ExchangeController Controller(ApartmentContext db) => new(db)
    {
        ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("userId", owner.ToString()) }, "test"))
        }}
    };

    [Fact]
    public async Task SuggestionsExcludeOwnUnavailableWrongCityAndPartialDateMatches_AndRankMutualFirst()
    {
        await using var db = Context();
        var offer = Offer();
        var mutual = Offer("ירושלים", " חיפה "); mutual.UserId = Guid.NewGuid();
        var oneWay = Offer("ירושלים", "תל אביב"); oneWay.UserId = Guid.NewGuid();
        var partial = Offer("ירושלים", "חיפה"); partial.UserId = Guid.NewGuid(); partial.AvailableFrom = Start.AddDays(1);
        var sold = Offer("ירושלים", "חיפה"); sold.UserId = Guid.NewGuid(); sold.Status = ApartmentStatus.Sold;
        var rent = Offer("ירושלים", "חיפה"); rent.UserId = Guid.NewGuid(); rent.ListingType = "Rent";
        var otherCity = Offer("תל אביב", "חיפה"); otherCity.UserId = Guid.NewGuid();
        db.Apartments.AddRange(offer, mutual, oneWay, partial, sold, rent, otherCity, Offer("ירושלים"));
        await db.SaveChangesAsync();
        var result = Assert.IsType<OkObjectResult>(await Controller(db).Matches(offer.ApartmentId, " ירושלים ", Start, End, default));
        var json = JsonSerializer.SerializeToElement(result.Value);
        Assert.Equal(2, json.GetArrayLength());
        Assert.True(json[0].GetProperty("IsMutual").GetBoolean());
        Assert.Equal(mutual.ApartmentId, json[0].GetProperty("Apartment").GetProperty("ApartmentId").GetGuid());
        Assert.False(json[1].GetProperty("IsMutual").GetBoolean());
    }

    [Fact]
    public async Task SuggestionsRejectAnotherPersonsOffer_AndInvalidDateRanges()
    {
        await using var db = Context();
        var other = Offer(); other.UserId = Guid.NewGuid(); db.Add(other); await db.SaveChangesAsync();
        Assert.IsType<NotFoundObjectResult>(await Controller(db).Matches(other.ApartmentId, "ירושלים", Start, End, default));
        Assert.IsType<BadRequestObjectResult>(await Controller(db).Matches(other.ApartmentId, "ירושלים", End, Start, default));
        Assert.IsType<BadRequestObjectResult>(await Controller(db).Matches(other.ApartmentId, "ירושלים", Start, Start, default));
        Assert.IsType<BadRequestObjectResult>(await Controller(db).Matches(other.ApartmentId, "ירושלים", Start.AddYears(-2), End, default));
    }

    [Fact]
    public async Task SuggestionsRejectOfferThatDoesNotCoverEntireStay()
    {
        await using var db = Context(); var offer = Offer(); db.Add(offer); await db.SaveChangesAsync();
        Assert.IsType<BadRequestObjectResult>(await Controller(db).Matches(offer.ApartmentId, "ירושלים", Start, End.AddDays(1), default));
    }

    [Fact]
    public void ExchangeTermsRequireDestinationAndIncreasingDates()
    {
        var terms = new ListingTerms { ListingType = "Exchange" };
        Assert.NotEmpty(terms.Validate(new ValidationContext(terms)));
        terms.DesiredCity = "חיפה"; terms.AvailableFrom = Start; terms.AvailableTo = End;
        Assert.Empty(terms.Validate(new ValidationContext(terms)));
        terms.AvailableTo = Start;
        Assert.NotEmpty(terms.Validate(new ValidationContext(terms)));
    }

    [Fact]
    public void HalfRoomsAndPurposeFilterWorkTogether()
    {
        var exchange = Offer(); exchange.SumOfRooms = 3.5m;
        var rental = Offer(); rental.ListingType = "Rent"; rental.SumOfRooms = 3;
        var result = ApartmentService.ApplySearchFilters(new[] { exchange, rental }.AsQueryable(),
            null, null, null, null, 3.5m, 4, null, null, null, "Exchange").ToList();
        Assert.Single(result); Assert.Equal(3.5m, ApartmentService.ToDTO(result[0]).SumOfRooms);
    }

    [Fact]
    public async Task ExchangeProposalPersistsBothHomesAndDates_AndRejectsForgedOffer()
    {
        await using var db = Context();
        var offer = Offer(); var target = Offer("ירושלים", "חיפה"); target.UserId = Guid.NewGuid();
        db.AddRange(offer, target);
        db.Users.Add(new User { UserId = owner, UserName = "Sender" });
        db.Users.Add(new User { UserId = target.UserId, UserName = "Recipient" });
        await db.SaveChangesAsync();
        var service = new MessageService(db, new NoEmail(), new ConfigurationBuilder().Build(), NullLogger<MessageService>.Instance);
        var dto = new CreateMessageDto { OwnerId = target.UserId, ApartmentId = target.ApartmentId,
            OfferedApartmentId = offer.ApartmentId, ExchangeStart = Start, ExchangeEnd = End, Content = "אפשר להחליף?" };
        await service.SendMessageAsync(dto, owner);
        var message = Assert.Single(await service.GetOwnerMessagesAsync(target.UserId, 1, 20));
        Assert.Equal(offer.ApartmentId, message.OfferedApartmentId);
        Assert.Equal(target.ApartmentId, message.ApartmentId);
        Assert.Equal(Start, message.ExchangeStart);
        dto.OfferedApartmentId = target.ApartmentId;
        await Assert.ThrowsAsync<ArgumentException>(() => service.SendMessageAsync(dto, owner));
        Assert.Equal(1, await db.Messages.CountAsync());
    }

    private class NoEmail : IEmailService
    {
        public Task SendTestEmailAsync(string? recipientEmail = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
