
namespace RequestBench.MinimalApis.Suite;

/// <summary>
/// parameters: route capture, at zero, one and two segments, each capture bound as an integer
/// and echoed.
///
/// Plan draws the captured values for this run and fills the pinned echo with them, so the
/// floor check is an echo check. A capture answered as a string fails it, and so does a
/// pattern that does not match, which answers 404. The static path also matches the
/// one-capture route beside it, and its plain payload is what shows the router chose the
/// literal.
/// </summary>
public sealed class ParametersTests(TargetApp app) : IClassFixture<TargetApp>
{
    // rb:test parameters.static
    [Fact]
    public async Task The_static_route_matches_ahead_of_the_capture_beside_it()
    {
        Ask ask = Plan.For("parameters.static");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test parameters.one
    [Fact]
    public async Task One_captured_segment_is_bound_as_an_integer()
    {
        Ask ask = Plan.For("parameters.one");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test parameters.two
    [Fact]
    public async Task Two_captured_segments_are_bound_the_same_way()
    {
        Ask ask = Plan.For("parameters.two");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }
}
