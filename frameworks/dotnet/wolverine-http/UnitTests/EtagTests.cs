namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class EtagTests(WolverineApp app)
{
    // rb:test etag.small,etag.large
    [Theory]
    [Trait("corpus", "etag.small")]
    [Trait("corpus", "etag.large")]
    [InlineData("small")]
    [InlineData("large")]
    public async Task The_answer_carries_a_validator(string size)
    {
        IScenarioResult result = await app.Host.Scenario(s => s.Get.Url($"/etag/{size}"));

        Assert.NotNull(Answer.Header(result, "etag"));
        Answer.Is(Expected.Json($"items.{size}.json"), result);
    }

    // rb:test etag.match_large
    [Fact]
    [Trait("corpus", "etag.match_large")]
    public async Task The_validator_it_issued_is_answered_304_with_no_body()
    {
        IScenarioResult first = await app.Host.Scenario(s => s.Get.Url("/etag/large"));
        Answer.Is(Expected.Json("items.large.json"), first);

        IScenarioResult second = await Conditional(Answer.Header(first, "etag")!, HttpStatusCode.NotModified);

        Assert.Empty(Answer.Bytes(second));
    }

    // rb:test etag.stale_large
    [Fact]
    [Trait("corpus", "etag.stale_large")]
    public async Task A_validator_it_never_issued_is_answered_in_full()
    {
        IScenarioResult result = await Conditional((string)Expected.Settings["staleEtag"]!, HttpStatusCode.OK);

        Answer.Is(Expected.Json("items.large.json"), result);
    }

    [Fact]
    public async Task The_body_is_hashed_again_on_every_request()
    {
        IScenarioResult first = await app.Host.Scenario(s => s.Get.Url("/etag/small"));
        IScenarioResult second = await app.Host.Scenario(s => s.Get.Url("/etag/small"));

        Assert.Equal(Answer.Header(first, "etag"), Answer.Header(second, "etag"));
        Assert.True(Answer.Serial(second) > Answer.Serial(first));
    }

    private Task<IScenarioResult> Conditional(string tag, HttpStatusCode status) => app.Host.Scenario(s =>
    {
        s.Get.Url("/etag/large");
        s.WithRequestHeader("if-none-match", tag);
        s.StatusCodeShouldBe(status);
    });
}
