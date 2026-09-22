namespace UnitTests;

/// <summary>/health and /__meta, which the contract asks for outside the corpus.</summary>
public sealed class ContractTests(App app) : TestBase<App>
{
    [Fact]
    public async Task Health_answers_once_the_payloads_are_loaded()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/health", Cancellation);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Meta_names_FastEndpoints_and_the_version_the_restore_resolved()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/__meta", Cancellation);
        JsonNode meta = await Answer.JsonAsync(response);

        Assert.Equal("FastEndpoints", (string?)meta["framework"]);
        Assert.Equal("8.3.0", (string?)meta["version"]);
        Assert.StartsWith(".NET 10", (string?)meta["runtime"]);
    }
}
