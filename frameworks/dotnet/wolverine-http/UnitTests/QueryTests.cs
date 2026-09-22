namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class QueryTests(WolverineApp app)
{
    // rb:test query.one
    [Fact]
    [Trait("corpus", "query.one")]
    public async Task One_value_is_bound_as_an_integer_and_echoed()
    {
        IScenarioResult result = await app.Host.Scenario(s => s.Get.Url("/query/one?page=417"));

        Answer.Is(Expected.WithEcho("items.small.json", new() { ["page"] = 417 }), result);
    }

    // rb:test query.many
    [Fact]
    [Trait("corpus", "query.many")]
    public async Task Eight_values_are_decoded_bound_and_echoed()
    {
        const string query = "page=417&size=38&status=paid&category=garden&sort=created&q=alpha%20bravo&minPrice=1200&maxPrice=34000";

        IScenarioResult result = await app.Host.Scenario(s => s.Get.Url($"/query/many?{query}"));

        Answer.Is(Expected.WithEcho("items.small.json", Search()), result);
    }

    /// <summary>The eight values, as the answer echoes them.</summary>
    internal static JsonObject Search() => new()
    {
        ["page"] = 417,
        ["size"] = 38,
        ["status"] = "paid",
        ["category"] = "garden",
        ["sort"] = "created",
        ["q"] = "alpha bravo",
        ["minPrice"] = 1200,
        ["maxPrice"] = 34000,
    };
}
