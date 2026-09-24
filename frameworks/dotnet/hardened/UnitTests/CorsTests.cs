namespace UnitTests;

public class CorsTests
{
    private static readonly string Origin = (string)Expected.Settings["cors"]!["origin"]!;

    // rb:test cors.preflight
    [HardenedTest]
    [Trait("corpus", "cors.preflight")]
    public async Task The_feature_answers_a_preflight_before_any_handler(ITestWebApp app)
    {
        TestWebResponse response = await Preflight(app, Origin);

        Assert.Equal(204, response.StatusCode);
        Assert.Equal(Origin, Answer.Header(response, "access-control-allow-origin"));
        Assert.Equal("x-rb-tenant", Answer.Header(response, "access-control-allow-headers"));
        Assert.Equal("600", Answer.Header(response, "access-control-max-age"));
        Assert.Null(Answer.Header(response, "x-rb-serial"));
    }

    // rb:test cors.disallowed
    [HardenedTest]
    [Trait("corpus", "cors.disallowed")]
    public async Task A_preflight_from_another_origin_is_not_allowed(ITestWebApp app)
    {
        TestWebResponse response = await Preflight(app, "https://elsewhere.example.net");

        Assert.Null(Answer.Header(response, "access-control-allow-origin"));
    }

    // rb:test cors.request,cors.vary
    [HardenedTest]
    [Trait("corpus", "cors.request")]
    [Trait("corpus", "cors.vary")]
    public async Task The_request_itself_reaches_the_handler_and_varies_on_origin(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/cors/small", request =>
        {
            request.Headers["Origin"] = Origin;
            request.Headers["x-rb-tenant"] = "qwertyuiopas";
        });

        await Answer.Is(Expected.Json("items.small.json"), response);
        Assert.Equal(Origin, Answer.Header(response, "access-control-allow-origin"));
        Assert.Equal("Origin", Answer.Header(response, "vary"));
        Assert.NotNull(Answer.Header(response, "x-rb-serial"));
    }

    // rb:test cors.scoped
    [HardenedTest]
    [Trait("corpus", "cors.scoped")]
    public async Task A_route_outside_cors_gets_no_policy(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/json/small", request => request.Headers["Origin"] = Origin);

        Assert.Null(Answer.Header(response, "access-control-allow-origin"));
    }

    private static Task<TestWebResponse> Preflight(ITestWebApp app, string origin) =>
        app.Request("OPTIONS", null, "/cors/small", request =>
        {
            request.Headers["Origin"] = origin;
            request.Headers["Access-Control-Request-Method"] = "GET";
            request.Headers["Access-Control-Request-Headers"] = "x-rb-tenant";
        });
}
