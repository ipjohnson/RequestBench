namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class StaticTests(WolverineApp app)
{
    // rb:test static.small,static.medium,static.large
    [Theory]
    [Trait("corpus", "static.small")]
    [Trait("corpus", "static.medium")]
    [Trait("corpus", "static.large")]
    [InlineData("items.small.json")]
    [InlineData("items.medium.json")]
    [InlineData("items.large.json")]
    public async Task The_file_is_sent_as_it_is_with_its_length_and_age(string name)
    {
        IScenarioResult result = await app.Host.Scenario(s =>
        {
            s.Get.Url($"/static/{name}");
            s.ContentTypeShouldBe("application/json");
        });

        byte[] file = Expected.Bytes(name);
        Assert.Equal(file, Answer.Bytes(result));
        Assert.Equal(file.Length, result.Context.Response.ContentLength);
        Assert.NotNull(Answer.Header(result, "last-modified"));
    }
}
