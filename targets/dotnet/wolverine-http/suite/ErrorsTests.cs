using Alba;
using Microsoft.AspNetCore.Http;

namespace RequestBench.WolverineTarget.Suite;

/// <summary>
/// errors: the three refusals that are nobody's fault but the request's.
///
/// All three are envelopes rather than pinned bodies. errors.unmatched is the one that tests
/// the framework rather than the handler: nothing registers that path, so what answers is
/// whatever the target does with a route it does not have.
/// </summary>
public sealed class ErrorsTests(TargetApp app) : IClassFixture<TargetApp>
{
    private const string Target = "dotnet:wolverine-http";

    // rb:test errors.not_found
    [Fact]
    public async Task A_registered_route_with_no_such_row_answers_404()
    {
        Ask ask = Plan.For("errors.not_found");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Envelope.Assert(status, type, raw, ask, Target);
    }

    // rb:test errors.unmatched
    [Fact]
    public async Task A_path_nothing_registers_answers_the_frameworks_own_404()
    {
        Ask ask = Plan.For("errors.unmatched");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Envelope.Assert(status, type, raw, ask, Target);
    }

    // rb:test errors.malformed
    [Fact]
    public async Task A_body_that_is_not_JSON_at_all_is_refused()
    {
        Ask ask = Plan.For("errors.malformed");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Envelope.Assert(status, type, raw, ask, Target);
    }
}
