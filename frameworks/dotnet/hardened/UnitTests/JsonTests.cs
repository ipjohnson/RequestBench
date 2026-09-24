namespace UnitTests;

public class JsonTests
{
    // rb:test json.small,json.medium,json.large
    [HardenedTest]
    [Trait("corpus", "json.small")]
    [Trait("corpus", "json.medium")]
    [Trait("corpus", "json.large")]
    [InlineData("small")]
    [InlineData("medium")]
    [InlineData("large")]
    public async Task Each_size_is_its_payload(string size, ITestWebApp app)
    {
        TestWebResponse response = await app.Get($"/json/{size}");

        await Answer.Is(Expected.Json($"items.{size}.json"), response);
    }
}
