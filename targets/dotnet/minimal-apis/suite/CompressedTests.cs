
namespace RequestBench.MinimalApis.Suite;

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

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
        Assert.Empty(response.Content.Headers.ContentEncoding);
    }

    // rb:test compressed.identity_large
    [Fact]
    public async Task The_large_payload_is_uncompressed_too_when_identity_was_asked_for()
    {
        Ask ask = Plan.For("compressed.identity_large");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
        Assert.Empty(response.Content.Headers.ContentEncoding);
    }

    // rb:test compressed.gzip_small
    [Fact]
    public async Task A_payload_under_the_shared_floor_is_sent_uncompressed_even_so()
    {
        Ask ask = Plan.For("compressed.gzip_small");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
        // spec/expected.json pins no encoding here: the small payload sits under the shared
        // gzip floor and the frameworks disagree about what to do with it. What this target
        // does is therefore the suite's to assert, not the expectation's.
        Assert.Empty(response.Content.Headers.ContentEncoding);
    }

    // rb:test compressed.gzip_large
    [Fact]
    public async Task A_payload_over_the_floor_is_gzipped_and_says_what_it_varies_on()
    {
        Ask ask = Plan.For("compressed.gzip_large");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
        Assert.Equal("gzip", Assert.Single(response.Content.Headers.ContentEncoding));
        // Nothing in ASP.NET Core adds Vary for a response compressed by hand, so a target
        // that forgot it would pass the floor and be wrong in front of any shared cache.
        Assert.Equal("Accept-Encoding", Assert.Single(response.Headers.Vary));
    }
}
