namespace UnitTests;

public class EtagTests
{
    // rb:test etag.small,etag.large
    [HardenedTest]
    [Trait("corpus", "etag.small")]
    [Trait("corpus", "etag.large")]
    [InlineData("small")]
    [InlineData("large")]
    public async Task The_answer_carries_a_validator(string size, ITestWebApp app)
    {
        TestWebResponse response = await app.Get($"/etag/{size}");

        Assert.NotNull(Answer.Header(response, "etag"));
        await Answer.Is(Expected.Json($"items.{size}.json"), response);
    }

    // rb:test etag.match_large
    [HardenedTest]
    [Trait("corpus", "etag.match_large")]
    public async Task The_validator_it_issued_is_answered_304_with_no_body(ITestWebApp app)
    {
        string tag = Answer.Header(await app.Get("/etag/large"), "etag")!;

        TestWebResponse response = await app.Get("/etag/large", request => request.Headers["If-None-Match"] = tag);

        Assert.Equal(304, response.StatusCode);
        Assert.Empty(await response.ReadTextAsync());
    }

    // rb:test etag.stale_large
    [HardenedTest]
    [Trait("corpus", "etag.stale_large")]
    public async Task A_validator_it_never_issued_is_answered_in_full(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/etag/large", request => request.Headers["If-None-Match"] = (string)Expected.Settings["staleEtag"]!);

        response.Assert.Ok();
        await Answer.Is(Expected.Json("items.large.json"), response);
    }
}
