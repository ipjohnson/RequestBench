namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class MiddlewareTests(WolverineApp app)
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
        IScenarioResult result = await app.Host.Scenario(s => s.Get.Url($"/middleware/{layers}"));

        Answer.Is(Expected.Json("items.small.json"), result);
    }
}
