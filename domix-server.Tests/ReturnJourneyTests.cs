using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;
namespace domix_server.Tests;
public class ReturnJourneyTests
{
    private sealed class Geo:IGeocodingService { public Task<(double? Latitude,double? Longitude)> GetCoordinatesAsync(string city,string address,CancellationToken cancellationToken=default)=>Task.FromResult<(double?,double?)>((null,null)); }
    [Fact]public async Task DraftReceiptReplaysOnlyTheOwnersListingWithoutOverwritingEdits()
    {
        await using var db=new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var owner=Guid.NewGuid();var receipt=Guid.NewGuid();var service=new ApartmentService(db,new Geo(),NullLogger<ApartmentService>.Instance);
        var dto=new CreateApartmentDTO{ClientDraftId=receipt,city="Haifa",area="Center",address="Street",price=4000,ListingType="Rent"};
        var first=await service.CreateApartmentAsync(dto,owner);dto.price=8000;var again=await service.CreateApartmentAsync(dto,owner);
        Assert.Equal(first.ApartmentId,again.ApartmentId);Assert.Equal(4000,again.price);Assert.Single(db.Apartments);
        var other=await service.CreateApartmentAsync(dto,Guid.NewGuid());Assert.NotEqual(first.ApartmentId,other.ApartmentId);
        var stored=await db.Apartments.SingleAsync(a=>a.ApartmentId==first.ApartmentId);stored.IsDeleted=true;await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(()=>service.CreateApartmentAsync(dto,owner));
    }
}
