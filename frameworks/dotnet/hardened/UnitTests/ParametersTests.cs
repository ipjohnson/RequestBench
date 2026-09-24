namespace UnitTests;

public class ParametersTests
{
    // rb:test parameters.static
    [HardenedTest]
    [Trait("corpus", "parameters.static")]
    public async Task The_literal_route_wins_over_the_token(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/parameters/static/segment/literal");

        await Answer.Is(Expected.Json("items.small.json"), response);
    }

    // rb:test parameters.one
    [HardenedTest]
    [Trait("corpus", "parameters.one")]
    public async Task One_token_is_bound_as_an_integer_and_echoed(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/parameters/4821/segment/literal");

        await Answer.Is(Expected.WithEcho("items.small.json", new() { ["one"] = 4821 }), response);
    }

    // rb:test parameters.two
    [HardenedTest]
    [Trait("corpus", "parameters.two")]
    public async Task Two_tokens_are_bound_and_echoed(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/parameters/4821/with-second/7390");

        await Answer.Is(Expected.WithEcho("items.small.json", new() { ["one"] = 4821, ["two"] = 7390 }), response);
    }

    [HardenedTest]
    public async Task A_token_that_is_not_an_integer_is_refused_by_the_binder(ITestWebApp app)
    {
        (await app.Get("/parameters/abc/segment/literal")).Assert.BadRequest();
    }
}
