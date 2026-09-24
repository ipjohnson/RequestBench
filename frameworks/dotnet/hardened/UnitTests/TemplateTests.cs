namespace UnitTests;

public class TemplateTests
{
    // rb:test template.small,template.medium
    [HardenedTest]
    [Trait("corpus", "template.small")]
    [Trait("corpus", "template.medium")]
    [InlineData("small")]
    [InlineData("medium")]
    public async Task The_view_renders_the_payload_as_the_corpus_page(string size, ITestWebApp app)
    {
        TestWebResponse response = await app.Get($"/template/{size}");

        Assert.Equal("text/html; charset=utf-8", Answer.Header(response, "content-type"));
        Assert.Equal(Expected.Normal(Expected.Page($"items.{size}.json")), Expected.Normal(await response.ReadTextAsync()));
    }
}
