namespace UnitTests;

public class EtagTests
{
    // rb:test etag.small,etag.large
    [ModuleTest]
    [Trait("corpus", "etag.small")]
    [Trait("corpus", "etag.large")]
    [InlineData("small")]
    [InlineData("large")]
    public async Task The_answer_carries_a_validator(string size, ITestWebApp app)
    {
        TestWebResponse response = await app.Get($"/etag/{size}");

        await Answer.Is(Expected.Json($"items.{size}.json"), response);
        Assert.Matches("^\"[^\"]+\"$", Answer.Header(response, "ETag"));
    }

    // rb:test etag.match_large
    [ModuleTest]
    [Trait("corpus", "etag.match_large")]
    public async Task The_validator_sent_back_is_not_modified(ITestWebApp app)
    {
        string tag = Answer.Header(await app.Get("/etag/large"), "ETag")!;

        TestWebResponse response = await app.Get("/etag/large", request => request.Headers["If-None-Match"] = tag);

        Assert.Equal(304, response.StatusCode);
        Assert.Equal(0, response.Body.Length);
    }

    // rb:test etag.stale_large
    [ModuleTest]
    [Trait("corpus", "etag.stale_large")]
    public async Task A_validator_it_never_sent_is_answered_in_full(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/etag/large", request => request.Headers["If-None-Match"] = (string)Expected.Settings["staleEtag"]!);

        response.Assert.Ok();
        await Answer.Is(Expected.Json("items.large.json"), response);
    }
}
