using RequestBench.Suite;

namespace RequestBench.CarterTarget.Suite;

/// <summary>
/// middleware, against the endpoint filters in Routes/Middleware.cs.
///
/// The layers are no-ops, so nothing they do is visible in a response and no assertion over
/// one can tell four apart from sixteen. What a test can hold is the thing that goes wrong
/// in practice: a test that calls the handler rather than the app passes while the layers
/// never ran at all. WebApplicationFactory boots the app, so the filters are in the path
/// here by construction, and the assertion that the answer is unchanged by sixteen of them
/// is the contract this family declares.
/// </summary>
public sealed class MiddlewareTests(TargetApp app) : IClassFixture<TargetApp>
{
    // rb:test middleware.none
    [Fact]
    public async Task The_unlayered_route_answers_the_shared_payload()
    {
        using HttpResponseMessage response = await app.Raw().GetAsync("/middleware/none");

        await Floor.AssertAsync(response, "middleware.none");
    }

    // rb:test middleware.four
    [Fact]
    public async Task Four_layers_do_not_change_the_answer()
    {
        using HttpResponseMessage response = await app.Raw().GetAsync("/middleware/four");

        await Floor.AssertAsync(response, "middleware.four");
    }

    // rb:test middleware.sixteen
    [Fact]
    public async Task Sixteen_layers_do_not_change_it_either()
    {
        using HttpResponseMessage response = await app.Raw().GetAsync("/middleware/sixteen");

        await Floor.AssertAsync(response, "middleware.sixteen");
    }
}
