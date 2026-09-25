namespace UnitTests;

/// <summary>/health and /__meta, which the contract asks of every target outside the corpus.</summary>
public class ContractTests
{
    [ModuleTest]
    public async Task Health_answers_with_a_body(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/health");

        response.Assert.Ok();
        Assert.Equal("ok", await response.ReadTextAsync());
    }

    [ModuleTest]
    public async Task Meta_names_the_framework_and_its_version(ITestWebApp app)
    {
        JsonNode meta = await Answer.Json(await app.Get("/__meta"));

        Assert.Equal("Hardened", (string)meta["framework"]!);
        Assert.Matches(@"^\d+\.\d+\.\d+", (string)meta["version"]!);
        Assert.StartsWith(".NET", (string)meta["runtime"]!);
    }
}
