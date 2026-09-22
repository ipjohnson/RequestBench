namespace UnitTests;

public sealed class JsonTests(CarterApp app) : IClassFixture<CarterApp>
{
    [Theory]
    [InlineData("small")]
    [InlineData("medium")]
    [InlineData("large")]
    public async Task Each_size_is_its_payload(string size)
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync($"/json/{size}");

        await Answer.Is(Expected.Json($"items.{size}.json"), response);
    }
}
