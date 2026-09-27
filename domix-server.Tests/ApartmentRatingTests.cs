using serverApi.Models;

namespace domix_server.Tests;

public class ApartmentRatingTests
{
    [Fact]
    public void FirstRating_BecomesTheRatingExactly()
    {
        var apartment = new Apartment();

        apartment.AddRating(4);

        Assert.Equal(4, apartment.Rating);
        Assert.Equal(1, apartment.RatingCount);
    }

    [Fact]
    public void SecondRating_AveragesWithTheFirst()
    {
        var apartment = new Apartment();
        apartment.AddRating(4);

        apartment.AddRating(4);

        Assert.Equal(4, apartment.Rating);
        Assert.Equal(2, apartment.RatingCount);
    }

    // Rating is stored as an int, so the running average truncates on an uneven split --
    // documented here so a future change to the type (e.g. to double) is a deliberate
    // decision, not an accidental behavior change this test would silently paper over.
    [Fact]
    public void UnevenAverage_TruncatesTowardZero()
    {
        var apartment = new Apartment();
        apartment.AddRating(4);

        apartment.AddRating(5); // (4*1 + 5) / 2 = 4 (not 4.5)

        Assert.Equal(4, apartment.Rating);
        Assert.Equal(2, apartment.RatingCount);
    }
}
