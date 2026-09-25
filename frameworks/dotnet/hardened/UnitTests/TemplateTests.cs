namespace UnitTests;

public class TemplateTests
{
    // rb:test template.small,template.medium
    [ModuleTest]
    [Trait("corpus", "template.small")]
    [Trait("corpus", "template.medium")]
    [InlineData("small")]
    [InlineData("medium")]
    public async Task The_page_renders_every_row(string size, ITestWebApp app)
    {
        TestWebResponse response = await app.Get($"/template/{size}");

        response.Assert.Ok();
        Assert.StartsWith("text/html", Answer.Header(response, "Content-Type"));
        Assert.Equal(Expected.Normal(Expected.Page($"items.{size}.json")), Expected.Normal(await response.ReadTextAsync()));
    }
}
