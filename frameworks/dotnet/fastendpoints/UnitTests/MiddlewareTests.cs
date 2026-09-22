using FastEndpoints;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace UnitTests;

public sealed class MiddlewareTests(App app) : TestBase<App>
{
    // rb:test middleware.none,middleware.four,middleware.sixteen
    [Theory]
    [Trait("corpus", "middleware.none")]
    [Trait("corpus", "middleware.four")]
    [Trait("corpus", "middleware.sixteen")]
    [InlineData("none")]
    [InlineData("four")]
    [InlineData("sixteen")]
    public async Task Every_layer_passes_the_request_through(string layers)
    {
        using HttpResponseMessage response = await app.Client.GetAsync($"/middleware/{layers}", Cancellation);

        await Answer.IsAsync(Expected.Json("items.small.json"), response);
    }

    [Theory]
    [InlineData("middleware/none", 0)]
    [InlineData("middleware/four", 4)]
    [InlineData("middleware/sixteen", 16)]
    public void The_endpoint_keeps_every_layer_it_names(string route, int layers)
    {
        EndpointDefinition definition = app.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Single(e => e.RoutePattern.RawText?.Trim('/') == route)
            .Metadata.GetRequiredMetadata<EndpointDefinition>();

        Assert.Equal(layers, definition.PreProcessorsList.Count());
    }
}
