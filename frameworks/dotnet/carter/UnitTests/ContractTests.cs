namespace UnitTests;

/// <summary>/health and /__meta, which the contract asks for outside the corpus.</summary>
public sealed class ContractTests(CarterApp app) : IClassFixture<CarterApp>
{
    [Fact]
    public async Task Health_answers_once_the_payloads_are_loaded()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Meta_names_Carter_and_the_version_the_restore_resolved()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/__meta");
        JsonNode meta = await Answer.Json(response);

        Assert.Equal("Carter", (string?)meta["framework"]);
        Assert.Equal("10.0.0", (string?)meta["version"]);
        Assert.StartsWith(".NET 10", (string?)meta["runtime"]);
    }
}
