namespace UnitTests;

/// <summary>/health and /__meta, which the contract asks for outside the corpus.</summary>
public sealed class ContractTests(MvcApp app) : IClassFixture<MvcApp>
{
    [Fact]
    public async Task Health_answers_once_the_payloads_are_loaded()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Meta_names_MVC_and_the_version_of_the_shared_framework_it_runs_on()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/__meta");
        JsonNode meta = await Answer.Json(response);

        Assert.Equal("ASP.NET Core MVC", (string?)meta["framework"]);
        Assert.StartsWith("10.0.", (string?)meta["version"]);
        Assert.StartsWith(".NET 10", (string?)meta["runtime"]);
    }
}
