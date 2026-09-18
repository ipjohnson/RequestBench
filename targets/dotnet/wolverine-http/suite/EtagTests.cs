using Alba;
using Microsoft.AspNetCore.Http;
using RequestBench.Suite;

namespace RequestBench.WolverineTarget.Suite;

/// <summary>
/// etag: the validator a target computes, and what it does when one comes back.
///
/// ASP.NET Core ships no conditional handling for a dynamic response, so every .NET target
/// here computes the digest itself. That makes the 304 the interesting one: it is the only
/// request in the corpus that cannot be sent until the target has answered a different one,
/// because the validator is the target's to produce.
/// </summary>
public sealed class EtagTests(TargetApp app) : IClassFixture<TargetApp>
{
    // rb:test etag.small
    [Fact]
    public async Task The_small_response_carries_a_validator()
    {
        Ask ask = Plan.For("etag.small");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
        HttpResponse answered = result.Context.Response;
        Assert.NotEmpty(answered.Headers.ETag.ToString());
    }

    // rb:test etag.large
    [Fact]
    public async Task So_does_the_large_one()
    {
        Ask ask = Plan.For("etag.large");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
        HttpResponse answered = result.Context.Response;
        Assert.NotEmpty(answered.Headers.ETag.ToString());
    }

    // rb:test etag.match_large
    [Fact]
    public async Task A_validator_the_target_just_issued_is_answered_with_304()
    {
        Ask ask = Plan.For("etag.match_large");

        IScenarioResult result = await app.SendAfterCapture(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
        HttpResponse answered = result.Context.Response;
        Assert.Null(answered.ContentType);
    }

    // rb:test etag.stale_large
    [Fact]
    public async Task A_validator_the_target_never_issued_is_answered_in_full()
    {
        Ask ask = Plan.For("etag.stale_large");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
        HttpResponse answered = result.Context.Response;
        Assert.NotEmpty(answered.Headers.ETag.ToString());
    }
}
