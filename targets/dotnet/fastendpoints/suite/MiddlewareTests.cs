using FastEndpoints.Testing;
using RequestBench.Suite;
using Xunit;

namespace RequestBench.FastEndpointsTarget.Suite;

/// <summary>
/// middleware, against the pre-processors in Routes/Middleware.cs.
///
/// The layers are no-ops, so nothing they do is visible in a response and no assertion over
/// one can tell four apart from sixteen. What a test can hold is the thing that goes wrong
/// in practice: a test that calls ExecuteAsync rather than the app passes while the
/// pre-processors never ran at all, and FastEndpoints makes that easy, because an endpoint
/// is a class anyone can new up. Going through the fixture's client is what puts them back
/// in the path.
/// </summary>
public sealed class MiddlewareTests(TargetApp app) : TestBase<TargetApp>
{
    // xunit.v3's analyzer refuses a call that takes a CancellationToken and is not given
    // the ambient one, and this repository builds warnings as errors. The four suites on
    // xunit 2.9.3 are not asked for it, which is part of what taking a framework's own test
    // package costs.
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    // rb:test middleware.none
    [Fact]
    public async Task The_unlayered_route_answers_the_shared_payload()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/middleware/none", Ct);

        await Floor.AssertAsync(response, "middleware.none");
    }

    // rb:test middleware.four
    [Fact]
    public async Task Four_layers_do_not_change_the_answer()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/middleware/four", Ct);

        await Floor.AssertAsync(response, "middleware.four");
    }

    // rb:test middleware.sixteen
    [Fact]
    public async Task Sixteen_layers_do_not_change_it_either()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/middleware/sixteen", Ct);

        await Floor.AssertAsync(response, "middleware.sixteen");
    }
}
