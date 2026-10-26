using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using serverApi.Models;
using serverApi.Services.Implementations;

namespace domix_server.Tests;

public class GoogleOAuthFailureTests
{
    private sealed class ResponseHandler(HttpStatusCode status, string json) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(json) });
    }
    private sealed class Factory(HttpStatusCode status, string json) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(new ResponseHandler(status, json));
    }
    [Fact]
    public async Task InvalidGrantRequiresReconnect()
    {
        var service = new GoogleOAuthService(new Factory(HttpStatusCode.BadRequest, "{\"error\":\"invalid_grant\"}"), NullLogger<GoogleOAuthService>.Instance);
        await Assert.ThrowsAsync<GmailReconnectRequiredException>(() => service.GetAccessTokenAsync(new GmailSettings()));
    }
    [Fact]
    public async Task TemporaryProviderFailureDoesNotClaimPermissionWasRevoked()
    {
        var service = new GoogleOAuthService(new Factory(HttpStatusCode.ServiceUnavailable, "{\"error\":\"temporarily_unavailable\"}"), NullLogger<GoogleOAuthService>.Instance);
        await Assert.ThrowsAsync<HttpRequestException>(() => service.GetAccessTokenAsync(new GmailSettings()));
    }
}
