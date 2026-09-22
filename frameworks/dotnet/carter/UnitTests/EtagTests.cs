namespace UnitTests;

public sealed class EtagTests(CarterApp app) : IClassFixture<CarterApp>
{
    // rb:test etag.small,etag.large
    [Theory]
    [Trait("corpus", "etag.small")]
    [Trait("corpus", "etag.large")]
    [InlineData("small")]
    [InlineData("large")]
    public async Task The_answer_carries_a_validator(string size)
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync($"/etag/{size}");

        Assert.NotNull(response.Headers.ETag);
        await Answer.Is(Expected.Json($"items.{size}.json"), response);
    }

    // rb:test etag.match_large
    [Fact]
    [Trait("corpus", "etag.match_large")]
    public async Task The_validator_it_issued_is_answered_304_with_no_body()
    {
        HttpClient client = app.CreateClient();
        using HttpResponseMessage first = await client.GetAsync("/etag/large");

        using HttpResponseMessage second = await Conditional(client, first.Headers.ETag!.Tag);

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
        Assert.Empty(await second.Content.ReadAsByteArrayAsync());
    }

    // rb:test etag.stale_large
    [Fact]
    [Trait("corpus", "etag.stale_large")]
    public async Task A_validator_it_never_issued_is_answered_in_full()
    {
        using HttpResponseMessage response = await Conditional(app.CreateClient(), (string)Expected.Settings["staleEtag"]!);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await Answer.Is(Expected.Json("items.large.json"), response);
    }

    private static Task<HttpResponseMessage> Conditional(HttpClient client, string tag)
    {
        HttpRequestMessage request = new(HttpMethod.Get, "/etag/large");
        request.Headers.TryAddWithoutValidation("if-none-match", tag);
        return client.SendAsync(request);
    }
}
