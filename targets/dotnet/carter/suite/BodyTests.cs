using RequestBench.Suite;

namespace RequestBench.CarterTarget.Suite;

/// <summary>
/// body: binding and validating a request body, at two sizes and two refusals.
///
/// Where the four .NET targets stop agreeing. Each reaches a different validation facility,
/// and the two refusals are judged as envelopes because what a framework answers when a body
/// is wrong is its own contract, not this repository's.
/// </summary>
public sealed class BodyTests(TargetApp app) : IClassFixture<TargetApp>
{
    private const string Target = "dotnet:carter";

    // rb:test body.bind_small
    [Fact]
    public async Task A_small_body_binds()
    {
        Ask ask = Plan.For("body.bind_small");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test body.bind_medium
    [Fact]
    public async Task A_medium_body_binds()
    {
        Ask ask = Plan.For("body.bind_medium");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test body.validate_small
    [Fact]
    public async Task A_small_body_that_is_valid_passes_validation()
    {
        Ask ask = Plan.For("body.validate_small");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test body.validate_medium
    [Fact]
    public async Task A_medium_body_that_is_valid_does_too()
    {
        Ask ask = Plan.For("body.validate_medium");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test body.rejected_all
    [Fact]
    public async Task A_body_failing_three_rules_is_refused()
    {
        Ask ask = Plan.For("body.rejected_all");

        using HttpResponseMessage response = await app.Send(ask);

        await Envelope.AssertAsync(response, ask, Target);
    }

    // rb:test body.rejected_first
    [Fact]
    public async Task A_body_failing_one_rule_is_refused_the_same_way()
    {
        Ask ask = Plan.For("body.rejected_first");

        using HttpResponseMessage response = await app.Send(ask);

        await Envelope.AssertAsync(response, ask, Target);
    }
}
