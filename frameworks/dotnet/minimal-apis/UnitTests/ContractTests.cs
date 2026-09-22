using System.Reflection;
using Microsoft.AspNetCore.Builder;

namespace UnitTests;

/// <summary>/health and /__meta, which the contract asks for outside the corpus.</summary>
public sealed class ContractTests(MinimalApisApp app) : IClassFixture<MinimalApisApp>
{
    [Fact]
    public async Task Health_answers_once_the_payloads_are_loaded()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Meta_names_minimal_APIs_and_the_version_of_the_shared_framework_that_runs()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/__meta");
        JsonNode meta = await Answer.Json(response);

        string running = typeof(WebApplication).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()!.InformationalVersion.Split('+')[0];
        Assert.StartsWith("10.0.", running);
        Assert.Equal("ASP.NET Core minimal APIs", (string?)meta["framework"]);
        Assert.Equal(running, (string?)meta["version"]);
        Assert.StartsWith(".NET 10", (string?)meta["runtime"]);
    }
}
