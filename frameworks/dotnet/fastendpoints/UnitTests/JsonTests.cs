namespace UnitTests;

public sealed class JsonTests(App app) : TestBase<App>
{
    // rb:test json.small,json.medium,json.large
    [Theory]
    [Trait("corpus", "json.small")]
    [Trait("corpus", "json.medium")]
    [Trait("corpus", "json.large")]
    [InlineData("small")]
    [InlineData("medium")]
    [InlineData("large")]
    public async Task Each_size_is_its_payload(string size)
    {
        using HttpResponseMessage response = await app.Client.GetAsync($"/json/{size}", Cancellation);

        await Answer.IsAsync(Expected.Json($"items.{size}.json"), response);
    }
}
