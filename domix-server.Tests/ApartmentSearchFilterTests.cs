using serverApi.Models;
using serverApi.Services.Implementations;

namespace domix_server.Tests;

public class ApartmentSearchFilterTests
{
    private static Apartment MakeApartment(
        string city = "Tel Aviv",
        string area = "Center",
        int price = 5000,
        int? rooms = 3,
        string? propertyType = "Apartment",
        bool? parking = true,
        bool? elevator = true,
        ApartmentStatus status = ApartmentStatus.Available)
    {
        return new Apartment
        {
            ApartmentId = Guid.NewGuid(),
            city = city,
            area = area,
            price = price,
            SumOfRooms = rooms,
            PropertyType = propertyType,
            Parking = parking,
            elevator = elevator,
            Status = status,
        };
    }

    private static List<Apartment> Filter(
        IEnumerable<Apartment> apartments,
        string? city = null,
        string? area = null,
        int? minPrice = null,
        int? maxPrice = null,
        int? minRooms = null,
        int? maxRooms = null,
        string? propertyType = null,
        bool? parking = null,
        bool? elevator = null)
    {
        return ApartmentService.ApplySearchFilters(
            apartments.AsQueryable(), city, area, minPrice, maxPrice, minRooms, maxRooms,
            propertyType, parking, elevator).ToList();
    }

    [Fact]
    public void ExcludesNonAvailableListings_EvenWithNoOtherFilters()
    {
        var apartments = new[]
        {
            MakeApartment(status: ApartmentStatus.Available),
            MakeApartment(status: ApartmentStatus.Rented),
            MakeApartment(status: ApartmentStatus.Sold),
        };

        var result = Filter(apartments);

        Assert.Single(result);
        Assert.Equal(ApartmentStatus.Available, result[0].Status);
    }

    [Fact]
    public void CityFilter_IsCaseSensitiveSubstringMatch()
    {
        var apartments = new[]
        {
            MakeApartment(city: "Tel Aviv"),
            MakeApartment(city: "Tel Aviv Yafo"),
            MakeApartment(city: "Jerusalem"),
        };

        var result = Filter(apartments, city: "Tel Aviv");

        Assert.Equal(2, result.Count);
        Assert.All(result, a => Assert.Contains("Tel Aviv", a.city));
    }

    [Fact]
    public void PriceRange_IsInclusiveOnBothEnds()
    {
        var apartments = new[]
        {
            MakeApartment(price: 3000),
            MakeApartment(price: 4000),
            MakeApartment(price: 5000),
        };

        var result = Filter(apartments, minPrice: 3000, maxPrice: 4000);

        Assert.Equal(2, result.Count);
        Assert.DoesNotContain(result, a => a.price == 5000);
    }

    [Fact]
    public void RoomsRange_ExcludesListingsOutsideIt()
    {
        var apartments = new[]
        {
            MakeApartment(rooms: 1),
            MakeApartment(rooms: 3),
            MakeApartment(rooms: 5),
        };

        var result = Filter(apartments, minRooms: 2, maxRooms: 4);

        Assert.Single(result);
        Assert.Equal(3, result[0].SumOfRooms);
    }

    [Fact]
    public void PropertyType_IsExactMatch_NotSubstring()
    {
        var apartments = new[]
        {
            MakeApartment(propertyType: "Apartment"),
            MakeApartment(propertyType: "Apartment Building"),
        };

        var result = Filter(apartments, propertyType: "Apartment");

        Assert.Single(result);
        Assert.Equal("Apartment", result[0].PropertyType);
    }

    [Fact]
    public void ParkingAndElevator_AreExactBooleanMatches()
    {
        var apartments = new[]
        {
            MakeApartment(parking: true, elevator: false),
            MakeApartment(parking: false, elevator: true),
            MakeApartment(parking: true, elevator: true),
        };

        var result = Filter(apartments, parking: true, elevator: true);

        Assert.Single(result);
        Assert.True(result[0].Parking);
        Assert.True(result[0].elevator);
    }

    [Fact]
    public void NoFiltersBesidesStatus_ReturnsEveryAvailableListing()
    {
        var apartments = new[] { MakeApartment(), MakeApartment(), MakeApartment() };

        var result = Filter(apartments);

        Assert.Equal(3, result.Count);
    }
}
