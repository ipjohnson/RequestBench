namespace UnitTests;

public sealed class MiddlewareTests(MvcApp app) : IClassFixture<MvcApp>
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
        using HttpResponseMessage response = await app.CreateClient().GetAsync($"/middleware/{layers}");

        await Answer.Is(Expected.Json("items.small.json"), response);
    }
}
