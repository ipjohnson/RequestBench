namespace UnitTests;

public sealed class MiddlewareTests(CarterApp app) : IClassFixture<CarterApp>
{
    [Theory]
    [InlineData("none")]
    [InlineData("four")]
    [InlineData("sixteen")]
    public async Task Every_layer_passes_the_request_through(string layers)
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync($"/middleware/{layers}");

        await Answer.Is(Expected.Json("items.small.json"), response);
    }
}
