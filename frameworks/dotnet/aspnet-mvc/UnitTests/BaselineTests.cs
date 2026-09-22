namespace UnitTests;

public sealed class BaselineTests(MvcApp app) : IClassFixture<MvcApp>
{
    // rb:test baseline.plaintext
    [Fact]
    [Trait("corpus", "baseline.plaintext")]
    public async Task Plaintext_is_the_literal_as_text()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/plaintext");

        Assert.Equal("Hello, World!", await response.Content.ReadAsStringAsync());
        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);
    }
}
