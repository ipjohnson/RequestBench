using Alba;
using Microsoft.AspNetCore.Http;
using RequestBench.Suite;

namespace RequestBench.WolverineTarget.Suite;

/// <summary>
/// body: binding and validating a request body, at two sizes and two refusals.
///
/// Where the four .NET targets stop agreeing. Each reaches a different validation facility,
/// and the two refusals are judged as envelopes because what a framework answers when a body
/// is wrong is its own contract, not this repository's.
/// </summary>
public sealed class BodyTests(TargetApp app) : IClassFixture<TargetApp>
{
    private const string Target = "dotnet:wolverine-http";

    // rb:test body.bind_small
    [Fact]
    public async Task A_small_body_binds()
    {
        Ask ask = Plan.For("body.bind_small");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
    }

    // rb:test body.bind_medium
    [Fact]
    public async Task A_medium_body_binds()
    {
        Ask ask = Plan.For("body.bind_medium");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
    }

    // rb:test body.validate_small
    [Fact]
    public async Task A_small_body_that_is_valid_passes_validation()
    {
        Ask ask = Plan.For("body.validate_small");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
    }

    // rb:test body.validate_medium
    [Fact]
    public async Task A_medium_body_that_is_valid_does_too()
    {
        Ask ask = Plan.For("body.validate_medium");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
    }

    // rb:test body.rejected_all
    [Fact]
    public async Task A_body_failing_three_rules_is_refused()
    {
        Ask ask = Plan.For("body.rejected_all");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Envelope.Assert(status, type, raw, ask, Target);
    }

    // rb:test body.rejected_first
    [Fact]
    public async Task A_body_failing_one_rule_is_refused_the_same_way()
    {
        Ask ask = Plan.For("body.rejected_first");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Envelope.Assert(status, type, raw, ask, Target);
    }
}
