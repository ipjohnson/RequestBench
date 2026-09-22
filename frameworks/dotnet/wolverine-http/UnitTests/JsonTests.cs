namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class JsonTests(WolverineApp app)
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
        IScenarioResult result = await app.Host.Scenario(s => s.Get.Url($"/json/{size}"));

        Answer.Is(Expected.Json($"items.{size}.json"), result);
    }
}
