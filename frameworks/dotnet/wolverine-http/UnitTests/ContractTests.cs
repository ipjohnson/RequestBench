namespace UnitTests;

/// <summary>/health and /__meta, which the contract asks for outside the corpus.</summary>
[Collection(nameof(WolverineApp))]
public sealed class ContractTests(WolverineApp app)
{
    [Fact]
    public async Task Health_answers_once_the_payloads_are_loaded()
    {
        await app.Host.Scenario(s =>
        {
            s.Get.Url("/health");
            s.StatusCodeShouldBeOk();
        });
    }

    [Fact]
    public async Task Meta_names_Wolverine_HTTP_and_the_version_the_restore_resolved()
    {
        IScenarioResult result = await app.Host.Scenario(s => s.Get.Url("/__meta"));
        JsonNode meta = Answer.Json(result);

        Assert.Equal("Wolverine.HTTP", (string?)meta["framework"]);
        Assert.Equal("6.39.1", (string?)meta["version"]);
        Assert.StartsWith(".NET 10", (string?)meta["runtime"]);
    }
}
