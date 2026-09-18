using Alba;
using Microsoft.AspNetCore.Http;

namespace RequestBench.WolverineTarget.Suite;

/// <summary>
/// authorized: one endpoint that refuses, and one that does not.
///
/// The pair is the test. A target that let everything through would pass the allowed case and
/// nothing else, so the denial is what carries the family, and its envelope is the
/// framework's own rather than this repository's.
/// </summary>
public sealed class AuthorizedTests(TargetApp app) : IClassFixture<TargetApp>
{
    private const string Target = "dotnet:wolverine-http";

    // rb:test authorized.allowed
    [Fact]
    public async Task A_request_carrying_the_token_is_served()
    {
        Ask ask = Plan.For("authorized.allowed");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
    }

    // rb:test authorized.denied
    [Fact]
    public async Task A_request_with_the_wrong_token_is_refused_in_the_frameworks_own_shape()
    {
        Ask ask = Plan.For("authorized.denied");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Envelope.Assert(status, type, raw, ask, Target);
    }
}
