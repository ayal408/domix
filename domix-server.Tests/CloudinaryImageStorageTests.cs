using System.Net;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Data;
using serverApi.Models;
using serverApi.Models.DTOs;
using serverApi.Services.Implementations;

namespace domix_server.Tests;

public class CloudinaryImageStorageTests
{
    private class Handler : HttpMessageHandler
    {
        public int Calls;
        public string Body = "";
        public HttpStatusCode Status = HttpStatusCode.OK;
        public string Url = "https://res.cloudinary.com/demo/image/upload/v1/domix/image.jpg";
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++; Body = await request.Content!.ReadAsStringAsync(ct);
            Assert.Equal("https://api.cloudinary.com/v1_1/demo/image/upload", request.RequestUri!.AbsoluteUri);
            return new HttpResponseMessage(Status) { Content = new StringContent("{\"secure_url\":\"" + Url + "\"}") };
        }
    }
    private static CloudinaryImageStorage Storage(Handler handler) => new(new HttpClient(handler), new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Cloudinary:CloudName"] = "demo", ["Cloudinary:ApiKey"] = "key", ["Cloudinary:ApiSecret"] = "secret-do-not-expose" }).Build());
    private static FormFile File() => new(new MemoryStream(new byte[] { 0xff, 0xd8, 0xff, 0 }), 0, 4, "Image", "photo.jpg");

    [Fact]
    public async Task RemoteUploadSavesDurableUrlOnlyAfterOwnershipAndSignatureChecks()
    {
        await using var db = new ApartmentContext(new DbContextOptionsBuilder<ApartmentContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var owner = Guid.NewGuid(); var id = Guid.NewGuid();
        db.Apartments.Add(new Apartment { ApartmentId = id, UserId = owner, city = "Jerusalem" }); await db.SaveChangesAsync();
        var handler = new Handler(); var service = new ApartmentImageService(db, NullLogger<ApartmentImageService>.Instance, Storage(handler));
        var dto = new UploadImageDto { ApartmentId = id, Image = File() };
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.UploadImageAsync(dto, Guid.NewGuid(), false));
        Assert.Equal(0, handler.Calls);
        var result = await service.UploadImageAsync(dto, owner, false);
        Assert.Equal(handler.Url, result.ImageUrl);
        Assert.Equal(handler.Url, (await db.ApartmentImages.SingleAsync()).ImageUrl);
        Assert.DoesNotContain("secret-do-not-expose", handler.Body);
        Assert.Contains("signature", handler.Body);
    }

    [Fact]
    public async Task ProviderFailureAndUnexpectedDeliveryHostAreRejected()
    {
        var handler = new Handler { Status = HttpStatusCode.TooManyRequests };
        await Assert.ThrowsAsync<InvalidOperationException>(() => Storage(handler).Upload(File(), default));
        handler.Status = HttpStatusCode.OK; handler.Url = "https://other.example/image.jpg";
        await Assert.ThrowsAsync<InvalidOperationException>(() => Storage(handler).Upload(File(), default));
        var empty = new CloudinaryImageStorage(new HttpClient(handler), new ConfigurationBuilder().Build());
        Assert.Throws<InvalidOperationException>(() => empty.ValidateConfiguration());
    }
}
