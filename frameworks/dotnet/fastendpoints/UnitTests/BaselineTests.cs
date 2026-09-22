namespace UnitTests;

public sealed class BaselineTests(App app) : TestBase<App>
{
    // rb:test baseline.plaintext
    [Fact]
    [Trait("corpus", "baseline.plaintext")]
    public async Task Plaintext_is_the_literal_as_text()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/plaintext", Cancellation);

        Assert.Equal("Hello, World!", await response.Content.ReadAsStringAsync(Cancellation));
        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);
    }
}
