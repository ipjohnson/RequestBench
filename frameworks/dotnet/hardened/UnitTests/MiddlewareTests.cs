namespace UnitTests;

public class MiddlewareTests
{
    // rb:test middleware.none,middleware.four,middleware.sixteen
    [ModuleTest]
    [Trait("corpus", "middleware.none")]
    [Trait("corpus", "middleware.four")]
    [Trait("corpus", "middleware.sixteen")]
    [InlineData("none")]
    [InlineData("four")]
    [InlineData("sixteen")]
    public async Task The_layers_pass_the_payload_through(string layers, ITestWebApp app)
    {
        TestWebResponse response = await app.Get($"/middleware/{layers}");

        await Answer.Is(Expected.Json("items.small.json"), response);
    }
}
