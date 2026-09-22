namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class ParametersTests(WolverineApp app)
{
    // rb:test parameters.static
    [Fact]
    [Trait("corpus", "parameters.static")]
    public async Task The_literal_route_wins_over_the_capture()
    {
        IScenarioResult result = await app.Host.Scenario(s => s.Get.Url("/parameters/static/segment/literal"));

        Answer.Is(Expected.Json("items.small.json"), result);
    }

    // rb:test parameters.one
    [Fact]
    [Trait("corpus", "parameters.one")]
    public async Task One_capture_is_bound_as_an_integer_and_echoed()
    {
        IScenarioResult result = await app.Host.Scenario(s => s.Get.Url("/parameters/4821/segment/literal"));

        Answer.Is(Expected.WithEcho("items.small.json", new() { ["one"] = 4821 }), result);
    }

    // rb:test parameters.two
    [Fact]
    [Trait("corpus", "parameters.two")]
    public async Task Two_captures_are_bound_and_echoed()
    {
        IScenarioResult result = await app.Host.Scenario(s => s.Get.Url("/parameters/4821/with-second/7390"));

        Answer.Is(Expected.WithEcho("items.small.json", new() { ["one"] = 4821, ["two"] = 7390 }), result);
    }

    [Fact]
    public async Task A_capture_that_is_not_an_integer_is_answered_404_by_the_generated_handler()
    {
        await app.Host.Scenario(s =>
        {
            s.Get.Url("/parameters/abc/segment/literal");
            s.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });
    }
}
