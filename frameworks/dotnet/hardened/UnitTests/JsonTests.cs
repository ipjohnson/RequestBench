namespace UnitTests;

public class JsonTests
{
    // rb:test json.small,json.medium,json.large
    [ModuleTest]
    [Trait("corpus", "json.small")]
    [Trait("corpus", "json.medium")]
    [Trait("corpus", "json.large")]
    [InlineData("small")]
    [InlineData("medium")]
    [InlineData("large")]
    public async Task Each_size_is_its_payload(string size, ITestWebApp app)
    {
        TestWebResponse response = await app.Get($"/json/{size}");

        response.Assert.Ok();
        Assert.StartsWith("application/json", Answer.Header(response, "Content-Type"));
        await Answer.Is(Expected.Json($"items.{size}.json"), response);
    }
}
