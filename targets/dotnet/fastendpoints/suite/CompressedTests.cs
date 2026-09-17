using FastEndpoints.Testing;
using RequestBench.Suite;
using Xunit;

namespace RequestBench.FastEndpointsTarget.Suite;

/// <summary>
/// compressed, against CompressedEndpoint.HandleAsync in Routes/Compressed.cs.
///
/// This target declares the family builtin: the codec is applied in HandleAsync, which
/// writes to the response body itself rather than returning a value something else
/// serializes. An in-memory test still runs all of it, because the writing is the handler.
///
/// The trap the family carries everywhere is the client, not the host. A client that decodes
/// transparently would make every assertion below pass against an identity response, so the
/// one here is AppFixture's plain Client and the gzip is undone by the floor assertion where
/// the comparison needs it.
/// </summary>
public sealed class CompressedTests(TargetApp app) : TestBase<TargetApp>
{
    private async Task<HttpResponseMessage> Send(string path, string acceptEncoding)
    {
        HttpRequestMessage request = new(HttpMethod.Get, path);
        // The headers spec/plan.json sends.
        request.Headers.TryAddWithoutValidation("accept-encoding", acceptEncoding);
        request.Headers.TryAddWithoutValidation("cache-control", "no-cache");
        return await app.Client.SendAsync(request, TestContext.Current.CancellationToken);
    }

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
        // gzip floor and the frameworks disagree about what to do with it. What this target
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
        // HandleAsync writes Vary itself. Nothing in FastEndpoints adds it for a response
        // compressed by hand, so a target that forgot it would still pass the floor and be
        // wrong in front of any shared cache.
        Assert.Equal("Accept-Encoding", Assert.Single(response.Headers.Vary));
    }
}
