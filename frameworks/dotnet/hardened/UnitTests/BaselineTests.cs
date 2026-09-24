namespace UnitTests;

public class BaselineTests
{
    // rb:test baseline.plaintext
    [HardenedTest]
    [Trait("corpus", "baseline.plaintext")]
    public async Task Plaintext_is_the_literal_as_text(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/plaintext");

        Assert.Equal("Hello, World!", await response.ReadTextAsync());
        Assert.Equal("text/plain", Answer.Header(response, "content-type"));
    }
}
