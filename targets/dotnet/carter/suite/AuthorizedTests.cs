using RequestBench.Suite;

namespace RequestBench.CarterTarget.Suite;

/// <summary>
/// authorized: one endpoint that refuses, and one that does not.
///
/// The pair is the test. A target that let everything through would pass the allowed case and
/// nothing else, so the denial is what carries the family, and its envelope is the
/// framework's own rather than this repository's.
/// </summary>
public sealed class AuthorizedTests(TargetApp app) : IClassFixture<TargetApp>
{
    private const string Target = "dotnet:carter";

    // rb:test authorized.allowed
    [Fact]
    public async Task A_request_carrying_the_token_is_served()
    {
        Ask ask = Plan.For("authorized.allowed");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test authorized.denied
    [Fact]
    public async Task A_request_with_the_wrong_token_is_refused_in_the_frameworks_own_shape()
    {
        Ask ask = Plan.For("authorized.denied");

        using HttpResponseMessage response = await app.Send(ask);

        await Envelope.AssertAsync(response, ask, Target);
    }
}
