using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Data;
using serverApi.Models;
using serverApi.Services.Implementations;
namespace domix_server.Tests;
public class ApartmentAreaOptionsTests
{
    [Fact]
    public async Task AreasAreDistinctCityScopedAndExcludeDeletedListings()
    {
        await using var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        Apartment Home(string city, string area, bool deleted = false) => new() { ApartmentId = Guid.NewGuid(), city = city, area = area, address = "Private street", IsDeleted = deleted };
        db.Apartments.AddRange(Home("Haifa", " Carmel "), Home("Haifa", "Carmel"), Home("Jerusalem", "Center"), Home("Haifa", "Deleted area", true), Home("Haifa", ""));
        await db.SaveChangesAsync();
        var service = new ApartmentService(db, null!, NullLogger<ApartmentService>.Instance);
        Assert.Equal(new[] { "Carmel" }, await service.GetAreasAsync("Haifa"));
        Assert.Equal(new[] { "Carmel", "Center" }, await service.GetAreasAsync(null));
    }
}
