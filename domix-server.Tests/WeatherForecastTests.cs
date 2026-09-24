using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace domix_server.Tests;

public class WeatherForecastTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public WeatherForecastTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetWeatherForecast_ReturnsOk()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/weatherforecast");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetWeatherForecast_ReturnsFiveDays()
    {
        var client = _factory.CreateClient();

        var forecasts = await client.GetFromJsonAsync<WeatherForecastDto[]>("/weatherforecast");

        Assert.NotNull(forecasts);
        Assert.Equal(5, forecasts!.Length);
    }

    [Theory]
    [InlineData(-20, -4)]
    [InlineData(0, 32)]
    [InlineData(55, 131)]
    public void TemperatureF_ConvertsFromCelsius(int celsius, int expectedFahrenheit)
    {
        var forecast = new WeatherForecast(DateOnly.FromDateTime(DateTime.Now), celsius, "Test");

        Assert.Equal(expectedFahrenheit, forecast.TemperatureF);
    }

    private record WeatherForecastDto(DateOnly Date, int TemperatureC, string? Summary);
}
