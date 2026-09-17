using RequestBench.Suite;

namespace RequestBench.MinimalApis.Suite;

/// <summary>
/// compressed, against the endpoint filter in Routes/Compressed.cs.
///
/// The family a test host can quietly fail to reach. Where a target compresses inside the
/// request pipeline an an in-memory test still runs the codec; where the compression belongs
/// to the server underneath, TestServer never reaches it and the only honest test is one
/// over a real port. Minimal APIs is the first kind, so every assertion here is made against
/// the bytes the filter produced.
///
/// The second trap is the client. Most test clients decode transparently, and one that did
/// would make every assertion below pass against an identity response. TargetApp.Raw() is
/// the plain CreateClient() for that reason, and the gzip is undone by the floor assertion
/// where the comparison needs it rather than by the transport.
/// </summary>
public sealed class CompressedTests(TargetApp app) : IClassFixture<TargetApp>
{
    private static HttpRequestMessage Ask(string path, string acceptEncoding)
    {
        HttpRequestMessage request = new(HttpMethod.Get, path);
        // The headers spec/plan.json sends. accept-encoding is what the family varies; the
        // no-cache is there because the plan sends it and a response cache that ignored it
        // would answer a different endpoint's body.
        request.Headers.TryAddWithoutValidation("accept-encoding", acceptEncoding);
        request.Headers.TryAddWithoutValidation("cache-control", "no-cache");
        return request;
    }

    private async Task<HttpResponseMessage> Send(string path, string acceptEncoding) =>
        await app.Raw().SendAsync(Ask(path, acceptEncoding));

    // rb:test compressed.identity_small
    [Fact]
    public async Task A_client_that_will_not_take_gzip_is_answered_in_full()
    {
        using HttpResponseMessage response = await Send("/compressed/small", "identity");

        await Floor.AssertAsync(response, "compressed.identity_small");
        Assert.Empty(response.Content.Headers.ContentEncoding);
    }

    // rb:test compressed.identity_large
    [Fact]
    public async Task The_large_payload_is_uncompressed_too_when_identity_was_asked_for()
    {
        using HttpResponseMessage response = await Send("/compressed/large", "identity");

        await Floor.AssertAsync(response, "compressed.identity_large");
        Assert.Empty(response.Content.Headers.ContentEncoding);
    }

    // rb:test compressed.gzip_small
    [Fact]
    public async Task A_payload_under_the_shared_floor_is_sent_uncompressed_even_so()
    {
        using HttpResponseMessage response = await Send("/compressed/small", "gzip");

        // spec/expected.json pins no encoding here: the small payload sits under the shared
        // gzip floor, the frameworks disagree about what to do with it, and the "unpinned"
        // block records the disagreement rather than choosing a winner. What this target
        // does is therefore the suite's to assert, not the expectation's.
        await Floor.AssertAsync(response, "compressed.gzip_small");
        Assert.Empty(response.Content.Headers.ContentEncoding);
    }

    // rb:test compressed.gzip_large
    [Fact]
    public async Task A_payload_over_the_floor_is_gzipped_and_says_what_it_varies_on()
    {
        using HttpResponseMessage response = await Send("/compressed/large", "gzip");

        await Floor.AssertAsync(response, "compressed.gzip_large");
        Assert.Equal("gzip", Assert.Single(response.Content.Headers.ContentEncoding));
        // The filter writes Vary itself. Nothing in ASP.NET Core adds it for a response
        // compressed by hand, so a target that forgot it would still pass the floor and be
        // wrong in front of any shared cache.
        Assert.Equal("Accept-Encoding", Assert.Single(response.Headers.Vary));
    }
}
