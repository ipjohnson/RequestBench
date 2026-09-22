namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class StaticTests(WolverineApp app)
{
    // rb:test static.file
    [Fact]
    [Trait("corpus", "static.file")]
    public async Task The_file_is_sent_as_it_is_with_its_length_and_age()
    {
        IScenarioResult result = await app.Host.Scenario(s =>
        {
            s.Get.Url("/static/items.large.json");
            s.ContentTypeShouldBe("application/json");
        });

        byte[] file = Expected.Bytes("items.large.json");
        Assert.Equal(file, Answer.Bytes(result));
        Assert.Equal(file.Length, result.Context.Response.ContentLength);
        Assert.NotNull(Answer.Header(result, "last-modified"));
    }
}
