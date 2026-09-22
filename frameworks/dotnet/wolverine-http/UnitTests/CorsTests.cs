using Microsoft.AspNetCore.Http;

namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class CorsTests(WolverineApp app)
{
    private static readonly string Origin = (string)Expected.Settings["cors"]!["origin"]!;

    // rb:test cors.preflight
    [Fact]
    [Trait("corpus", "cors.preflight")]
    public async Task The_feature_answers_a_preflight_before_any_handler()
    {
        IScenarioResult result = await Preflight(Origin);

        Assert.Equal(Origin, Answer.Header(result, "access-control-allow-origin"));
        Assert.Equal("x-rb-tenant", Answer.Header(result, "access-control-allow-headers"));
        Assert.Equal("600", Answer.Header(result, "access-control-max-age"));
        Assert.Null(Answer.Header(result, "x-rb-serial"));
    }

    // rb:test cors.disallowed
    [Fact]
    [Trait("corpus", "cors.disallowed")]
    public async Task A_preflight_from_another_origin_is_not_allowed()
    {
        IScenarioResult result = await Preflight("https://elsewhere.example.net");

        Assert.Null(Answer.Header(result, "access-control-allow-origin"));
    }

    // rb:test cors.request,cors.vary
    [Fact]
    [Trait("corpus", "cors.request")]
    [Trait("corpus", "cors.vary")]
    public async Task The_request_itself_reaches_the_handler_and_varies_on_origin()
    {
        IScenarioResult result = await app.Host.Scenario(s =>
        {
            s.Get.Url("/cors/small");
            s.WithRequestHeader("origin", Origin);
            s.WithRequestHeader("x-rb-tenant", "qwertyuiopas");
        });

        Answer.Is(Expected.Json("items.small.json"), result);
        Assert.Equal(Origin, Answer.Header(result, "access-control-allow-origin"));
        Assert.Equal("Origin", Answer.Header(result, "vary"));
        Assert.NotNull(Answer.Header(result, "x-rb-serial"));
    }

    // rb:test cors.scoped
    [Fact]
    [Trait("corpus", "cors.scoped")]
    public async Task A_route_outside_cors_gets_no_policy()
    {
        IScenarioResult result = await app.Host.Scenario(s =>
        {
            s.Get.Url("/json/small");
            s.WithRequestHeader("origin", Origin);
        });

        Assert.Null(Answer.Header(result, "access-control-allow-origin"));
    }

    /// <summary>Alba names no OPTIONS scenario, so the GET one is sent as OPTIONS.</summary>
    private Task<IScenarioResult> Preflight(string origin) => app.Host.Scenario(s =>
    {
        s.Get.Url("/cors/small");
        s.ConfigureHttpContext(c => c.Request.Method = HttpMethods.Options);
        s.WithRequestHeader("origin", origin);
        s.WithRequestHeader("access-control-request-method", "GET");
        s.WithRequestHeader("access-control-request-headers", "x-rb-tenant");
        s.StatusCodeShouldBe(HttpStatusCode.NoContent);
    });
}
