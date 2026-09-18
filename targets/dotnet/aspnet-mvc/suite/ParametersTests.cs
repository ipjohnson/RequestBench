using RequestBench.Suite;

namespace RequestBench.AspNetMvc.Suite;

/// <summary>
/// parameters: route capture, at zero, one and two segments.
///
/// The captured values do not reach the answer. The payload is the shared one, so what these
/// hold is that the route matched at all: a target whose two-segment pattern is wrong answers
/// 404 and the floor says so on the status line before it ever looks at a body.
/// </summary>
public sealed class ParametersTests(TargetApp app) : IClassFixture<TargetApp>
{
    // rb:test parameters.static
    [Fact]
    public async Task A_route_with_nothing_to_capture_matches()
    {
        Ask ask = Plan.For("parameters.static");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test parameters.one
    [Fact]
    public async Task One_captured_segment_matches()
    {
        Ask ask = Plan.For("parameters.one");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test parameters.two
    [Fact]
    public async Task Two_captured_segments_match()
    {
        Ask ask = Plan.For("parameters.two");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }
}
