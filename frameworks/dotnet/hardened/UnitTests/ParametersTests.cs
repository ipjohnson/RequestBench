namespace UnitTests;

public class ParametersTests
{
    // rb:test parameters.static
    [ModuleTest]
    [Trait("corpus", "parameters.static")]
    public async Task The_literal_route_wins_over_the_token(ITestWebApp app)
    {
        await Answer.Is(Expected.Json("items.small.json"), await app.Get("/parameters/static/segment/literal"));
    }

    // rb:test parameters.one
    [ModuleTest]
    [Trait("corpus", "parameters.one")]
    public async Task One_token_is_bound_and_echoed(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/parameters/4321/segment/literal");

        await Answer.Is(Expected.WithEcho("items.small.json", new JsonObject { ["one"] = 4321 }), response);
    }

    // rb:test parameters.two
    [ModuleTest]
    [Trait("corpus", "parameters.two")]
    public async Task Two_tokens_are_bound_and_echoed(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/parameters/4321/with-second/8765");

        await Answer.Is(Expected.WithEcho("items.small.json", new JsonObject { ["one"] = 4321, ["two"] = 8765 }), response);
    }
}
