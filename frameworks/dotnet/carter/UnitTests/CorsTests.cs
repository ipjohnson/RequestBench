namespace UnitTests;

public sealed class CorsTests(CarterApp app) : IClassFixture<CarterApp>
{
    private static readonly string Origin = (string)Expected.Settings["cors"]!["origin"]!;

    // rb:test cors.preflight
    [Fact]
    [Trait("corpus", "cors.preflight")]
    public async Task The_feature_answers_a_preflight_before_any_handler()
    {
        using HttpResponseMessage response = await Preflight(Origin);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(Origin, Answer.Header(response, "access-control-allow-origin"));
        Assert.Equal("x-rb-tenant", Answer.Header(response, "access-control-allow-headers"));
        Assert.Equal("600", Answer.Header(response, "access-control-max-age"));
        Assert.Null(Answer.Header(response, "x-rb-serial"));
    }

    // rb:test cors.disallowed
    [Fact]
    [Trait("corpus", "cors.disallowed")]
    public async Task A_preflight_from_another_origin_is_not_allowed()
    {
        using HttpResponseMessage response = await Preflight("https://elsewhere.example.net");

        Assert.Null(Answer.Header(response, "access-control-allow-origin"));
    }

    // rb:test cors.request,cors.vary
    [Fact]
    [Trait("corpus", "cors.request")]
    [Trait("corpus", "cors.vary")]
    public async Task The_request_itself_reaches_the_handler_and_varies_on_origin()
    {
        using HttpRequestMessage request = new(HttpMethod.Get, "/cors/small");
        request.Headers.Add("origin", Origin);
        request.Headers.Add("x-rb-tenant", "qwertyuiopas");

        using HttpResponseMessage response = await app.CreateClient().SendAsync(request);

        await Answer.Is(Expected.Json("items.small.json"), response);
        Assert.Equal(Origin, Answer.Header(response, "access-control-allow-origin"));
        Assert.Equal("Origin", Answer.Header(response, "vary"));
        Assert.NotNull(Answer.Header(response, "x-rb-serial"));
    }

    // rb:test cors.scoped
    [Fact]
    [Trait("corpus", "cors.scoped")]
    public async Task A_route_outside_cors_gets_no_policy()
    {
        using HttpRequestMessage request = new(HttpMethod.Get, "/json/small");
        request.Headers.Add("origin", Origin);

        using HttpResponseMessage response = await app.CreateClient().SendAsync(request);

        Assert.Null(Answer.Header(response, "access-control-allow-origin"));
    }

    private Task<HttpResponseMessage> Preflight(string origin)
    {
        HttpRequestMessage request = new(HttpMethod.Options, "/cors/small");
        request.Headers.Add("origin", origin);
        request.Headers.Add("access-control-request-method", "GET");
        request.Headers.Add("access-control-request-headers", "x-rb-tenant");
        return app.CreateClient().SendAsync(request);
    }
}
