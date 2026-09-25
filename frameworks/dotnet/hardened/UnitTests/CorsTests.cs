namespace UnitTests;

public class CorsTests
{
    private static string Cors(string name) => (string)Expected.Settings["cors"]![name]!;

    // rb:test cors.preflight
    [ModuleTest]
    [Trait("corpus", "cors.preflight")]
    public async Task The_preflight_is_answered_before_any_handler(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("OPTIONS", null, "/cors/small", request =>
        {
            request.Headers["Origin"] = Cors("origin");
            request.Headers["Access-Control-Request-Method"] = Cors("method");
            request.Headers["Access-Control-Request-Headers"] = Cors("header");
        });

        Assert.Equal(204, response.StatusCode);
        Assert.Equal(Cors("origin"), Answer.Header(response, "Access-Control-Allow-Origin"));
        Assert.Equal(Cors("header"), Answer.Header(response, "Access-Control-Allow-Headers"));
        Assert.Equal(((int)Expected.Settings["cors"]!["maxAgeSeconds"]!).ToString(), Answer.Header(response, "Access-Control-Max-Age"));
        Assert.Null(Answer.Header(response, "x-rb-serial"));
    }

    // rb:test cors.request,cors.vary
    [ModuleTest]
    [Trait("corpus", "cors.request")]
    [Trait("corpus", "cors.vary")]
    public async Task The_request_reaches_the_handler_with_the_origin_allowed(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/cors/small", request =>
        {
            request.Headers["Origin"] = Cors("origin");
            request.Headers[Cors("header")] = "tenant";
        });

        await Answer.Is(Expected.Json("items.small.json"), response);
        Assert.Equal(Cors("origin"), Answer.Header(response, "Access-Control-Allow-Origin"));
        Assert.Contains("Origin", Answer.Header(response, "Vary"));
        Assert.NotNull(Answer.Header(response, "x-rb-serial"));
    }

    // rb:test cors.disallowed
    [ModuleTest]
    [Trait("corpus", "cors.disallowed")]
    public async Task Another_origin_gets_no_allow_origin(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("OPTIONS", null, "/cors/small", request =>
        {
            request.Headers["Origin"] = "https://elsewhere.example.net";
            request.Headers["Access-Control-Request-Method"] = Cors("method");
            request.Headers["Access-Control-Request-Headers"] = Cors("header");
        });

        Assert.Null(Answer.Header(response, "Access-Control-Allow-Origin"));
    }

    // rb:test cors.scoped
    [ModuleTest]
    [Trait("corpus", "cors.scoped")]
    public async Task A_route_outside_cors_gets_no_allow_origin(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/json/small", request => request.Headers["Origin"] = Cors("origin"));

        response.Assert.Ok();
        Assert.Null(Answer.Header(response, "Access-Control-Allow-Origin"));
    }
}
