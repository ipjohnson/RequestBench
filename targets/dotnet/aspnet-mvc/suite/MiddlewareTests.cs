using RequestBench.Suite;

namespace RequestBench.AspNetMvc.Suite;

/// <summary>
/// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
///
/// The layers are no-ops, so nothing they do is visible in a response and no assertion over
/// one can tell four apart from sixteen. What a test can hold is the thing that goes wrong in
/// practice: a test that calls the handler rather than the app passes while the layers never
/// ran at all. The test host boots the application, so the layers are in the path here by
/// construction, and that is the whole of what these three assert.
/// </summary>
public sealed class MiddlewareTests(TargetApp app) : IClassFixture<TargetApp>
{
    // rb:test middleware.none
    [Fact]
    public async Task The_unlayered_route_answers_the_shared_payload()
    {
        Ask ask = Plan.For("middleware.none");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test middleware.four
    [Fact]
    public async Task Four_layers_do_not_change_the_answer()
    {
        Ask ask = Plan.For("middleware.four");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test middleware.sixteen
    [Fact]
    public async Task Sixteen_layers_do_not_change_it_either()
    {
        Ask ask = Plan.For("middleware.sixteen");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }
}
