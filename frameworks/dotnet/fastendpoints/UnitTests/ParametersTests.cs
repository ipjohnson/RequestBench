namespace UnitTests;

public sealed class ParametersTests(App app) : TestBase<App>
{
    // rb:test parameters.static
    [Fact]
    [Trait("corpus", "parameters.static")]
    public async Task The_literal_route_wins_over_the_capture()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/parameters/static/segment/literal", Cancellation);

        await Answer.IsAsync(Expected.Json("items.small.json"), response);
    }

    // rb:test parameters.one
    [Fact]
    [Trait("corpus", "parameters.one")]
    public async Task One_capture_is_bound_as_an_integer_and_echoed()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/parameters/4821/segment/literal", Cancellation);

        await Answer.IsAsync(Expected.WithEcho("items.small.json", new() { ["one"] = 4821 }), response);
    }

    // rb:test parameters.two
    [Fact]
    [Trait("corpus", "parameters.two")]
    public async Task Two_captures_are_bound_and_echoed()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/parameters/4821/with-second/7390", Cancellation);

        await Answer.IsAsync(Expected.WithEcho("items.small.json", new() { ["one"] = 4821, ["two"] = 7390 }), response);
    }

    [Fact]
    public async Task A_capture_that_is_not_an_integer_is_refused_by_the_binder_naming_it()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/parameters/abc/segment/literal", Cancellation);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["one"], (await Answer.JsonAsync(response))["errors"]!.AsObject().Select(e => e.Key));
    }
}
