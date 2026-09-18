using Alba;
using Microsoft.AspNetCore.Http;

namespace RequestBench.WolverineTarget.Suite;

/// <summary>
/// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
///
/// The family a test host can quietly fail to reach. Where a target compresses inside the
/// request pipeline an in-memory test still runs the codec; where the compression belongs to
/// the server underneath, TestServer never reaches it and the only honest test is one over a
/// real port, which WebApplicationFactory.UseKestrel(0) and StartServer() give without
/// leaving the process. Every .NET target is the first kind.
///
/// The second trap is the client. Most test clients decode transparently, and one that did
/// would make every assertion below pass against an identity response. The client here is the
/// plain CreateClient() for that reason, and the gzip is undone by the floor assertion where
/// the comparison needs it rather than by the transport.
/// </summary>
public sealed class CompressedTests(TargetApp app) : IClassFixture<TargetApp>
{
    // rb:test compressed.identity_small
    [Fact]
    public async Task A_client_that_will_not_take_gzip_is_answered_in_full()
    {
        Ask ask = Plan.For("compressed.identity_small");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
        Assert.Equal("", encoding);
    }

    // rb:test compressed.identity_large
    [Fact]
    public async Task The_large_payload_is_uncompressed_too_when_identity_was_asked_for()
    {
        Ask ask = Plan.For("compressed.identity_large");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
        Assert.Equal("", encoding);
    }

    // rb:test compressed.gzip_small
    [Fact]
    public async Task A_payload_under_the_shared_floor_is_sent_uncompressed_even_so()
    {
        Ask ask = Plan.For("compressed.gzip_small");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
        // spec/expected.json pins no encoding here: the small payload sits under the shared
        // gzip floor and the frameworks disagree about what to do with it. What this target
        // does is therefore the suite's to assert, not the expectation's.
        Assert.Equal("", encoding);
    }

    // rb:test compressed.gzip_large
    [Fact]
    public async Task A_payload_over_the_floor_is_gzipped_and_says_what_it_varies_on()
    {
        Ask ask = Plan.For("compressed.gzip_large");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
        HttpResponse answered = result.Context.Response;
        Assert.Equal("gzip", encoding);
        // Nothing in ASP.NET Core adds Vary for a response compressed by hand, so a target
        // that forgot it would pass the floor and be wrong in front of any shared cache.
        Assert.Equal("Accept-Encoding", answered.Headers.Vary.ToString());
    }
}
