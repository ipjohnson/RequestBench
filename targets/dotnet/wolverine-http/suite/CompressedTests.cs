using Alba;
using RequestBench.Suite;

namespace RequestBench.WolverineTarget.Suite;

/// <summary>
/// compressed, against Serve in Routes/Compressed.cs.
///
/// Wolverine compiles the endpoint and hands the result to ASP.NET, so the codec these three
/// routes carry runs inside the pipeline and an in-memory scenario reaches it. Alba never
/// goes near a socket, which for this family is only safe because of that.
///
/// The client trap the other four suites have does not arise here, because Alba hands back
/// the response the endpoint wrote rather than a decoded one. The bytes read below are the
/// bytes Serve produced.
/// </summary>
public sealed class CompressedTests(TargetApp app) : IClassFixture<TargetApp>
{
    private async Task<IScenarioResult> Send(string path, string acceptEncoding) =>
        await app.Host.Scenario(scenario =>
        {
            scenario.Get.Url(path);
            // The headers spec/plan.json sends.
            scenario.WithRequestHeader("accept-encoding", acceptEncoding);
            scenario.WithRequestHeader("cache-control", "no-cache");
            // Alba asserts 200 unless told not to. The status spec/expected.json pins is the
            // authority here, and two of them would mean a wrong expectation could be
            // masked by a scenario that happened to agree with the target.
            scenario.IgnoreStatusCode();
        });

    // rb:test compressed.identity_small
    [Fact]
    public async Task A_client_that_will_not_take_gzip_is_answered_in_full()
    {
        (int status, string type, string encoding, byte[] raw) =
            TargetApp.Answer(await Send("/compressed/small", "identity"));

        Floor.Assert(Spec.For("compressed.identity_small"), status, type, encoding, raw);
        Assert.Equal("", encoding);
    }

    // rb:test compressed.identity_large
    [Fact]
    public async Task The_large_payload_is_uncompressed_too_when_identity_was_asked_for()
    {
        (int status, string type, string encoding, byte[] raw) =
            TargetApp.Answer(await Send("/compressed/large", "identity"));

        Floor.Assert(Spec.For("compressed.identity_large"), status, type, encoding, raw);
        Assert.Equal("", encoding);
    }

    // rb:test compressed.gzip_small
    [Fact]
    public async Task A_payload_under_the_shared_floor_is_sent_uncompressed_even_so()
    {
        (int status, string type, string encoding, byte[] raw) =
            TargetApp.Answer(await Send("/compressed/small", "gzip"));

        // spec/expected.json pins no encoding here: the small payload sits under the shared
        // gzip floor and the frameworks disagree about what to do with it. What this target
        // does is therefore the suite's to assert, not the expectation's.
        Floor.Assert(Spec.For("compressed.gzip_small"), status, type, encoding, raw);
        Assert.Equal("", encoding);
    }

    // rb:test compressed.gzip_large
    [Fact]
    public async Task A_payload_over_the_floor_is_gzipped_and_says_what_it_varies_on()
    {
        IScenarioResult result = await Send("/compressed/large", "gzip");
        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);

        Floor.Assert(Spec.For("compressed.gzip_large"), status, type, encoding, raw);
        Assert.Equal("gzip", encoding);
        // Serve writes Vary itself. Nothing in Wolverine adds it for a response compressed by
        // hand, so a target that forgot it would still pass the floor and be wrong in front
        // of any shared cache.
        Assert.Equal("Accept-Encoding", result.Context.Response.Headers.Vary.ToString());
    }
}
