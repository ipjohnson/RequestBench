namespace UnitTests;

public sealed class ParametersTests(CarterApp app) : IClassFixture<CarterApp>
{
    [Fact]
    public async Task The_literal_route_wins_over_the_capture()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/parameters/static/segment/literal");

        await Answer.Is(Expected.Json("items.small.json"), response);
    }

    [Fact]
    public async Task One_capture_is_bound_as_an_integer_and_echoed()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/parameters/4821/segment/literal");

        await Answer.Is(Expected.WithEcho("items.small.json", new() { ["one"] = 4821 }), response);
    }

    [Fact]
    public async Task Two_captures_are_bound_and_echoed()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/parameters/4821/with-second/7390");

        await Answer.Is(Expected.WithEcho("items.small.json", new() { ["one"] = 4821, ["two"] = 7390 }), response);
    }

    [Fact]
    public async Task A_capture_that_is_not_an_integer_is_refused_by_the_binder()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/parameters/abc/segment/literal");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
