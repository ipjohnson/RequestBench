namespace UnitTests;

public class BaselineTests
{
    // rb:test baseline.plaintext
    [ModuleTest]
    [Trait("corpus", "baseline.plaintext")]
    public async Task Plaintext_is_the_text_as_plain_text(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/plaintext");

        response.Assert.Ok();
        Assert.StartsWith("text/plain", Answer.Header(response, "Content-Type"));
        Assert.Equal("Hello, World!", await response.ReadTextAsync());
    }
}
