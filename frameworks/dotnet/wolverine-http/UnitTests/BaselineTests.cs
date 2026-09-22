namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class BaselineTests(WolverineApp app)
{
    // rb:test baseline.plaintext
    [Fact]
    [Trait("corpus", "baseline.plaintext")]
    public async Task Plaintext_is_the_literal_as_text()
    {
        IScenarioResult result = await app.Host.Scenario(s =>
        {
            s.Get.Url("/plaintext");
            s.ContentTypeShouldBe("text/plain");
        });

        Assert.Equal("Hello, World!", result.ReadAsText());
    }
}
