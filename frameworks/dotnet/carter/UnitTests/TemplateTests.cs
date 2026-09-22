namespace UnitTests;

public sealed class TemplateTests(CarterApp app) : IClassFixture<CarterApp>
{
    // rb:test template.small,template.medium
    [Theory]
    [Trait("corpus", "template.small")]
    [Trait("corpus", "template.medium")]
    [InlineData("small")]
    [InlineData("medium")]
    public async Task The_component_renders_the_payload_as_the_corpus_page(string size)
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync($"/template/{size}");

        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(Expected.Normal(Expected.Page($"items.{size}.json")), Expected.Normal(await response.Content.ReadAsStringAsync()));
    }
}
