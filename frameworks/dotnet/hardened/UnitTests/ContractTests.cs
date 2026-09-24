namespace UnitTests;

/// <summary>/health and /__meta, which the contract asks for outside the corpus.</summary>
public class ContractTests
{
    [HardenedTest]
    public async Task Health_answers_once_the_payloads_are_loaded(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/health");

        Assert.Equal("ok", await response.ReadTextAsync());
    }

    [HardenedTest]
    public async Task Meta_names_Hardened_and_the_version_the_restore_resolved(ITestWebApp app)
    {
        JsonNode meta = await Answer.Json(await app.Get("/__meta"));

        Assert.Equal("Hardened", (string?)meta["framework"]);
        Assert.Equal("0.39.0-rc1000", (string?)meta["version"]);
        Assert.StartsWith(".NET 10", (string?)meta["runtime"]);
    }
}
