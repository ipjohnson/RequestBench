namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class TemplateTests(WolverineApp app)
{
    // rb:test template.small,template.medium
    [Theory]
    [Trait("corpus", "template.small")]
    [Trait("corpus", "template.medium")]
    [InlineData("small")]
    [InlineData("medium")]
    public async Task The_component_renders_the_payload_as_the_corpus_page(string size)
    {
        IScenarioResult result = await app.Host.Scenario(s =>
        {
            s.Get.Url($"/template/{size}");
            s.ContentTypeShouldBe("text/html; charset=utf-8");
        });

        Assert.Equal(Expected.Normal(Expected.Page($"items.{size}.json")), Expected.Normal(result.ReadAsText()));
    }
}
