namespace UnitTests;

public sealed class QueryTests(MvcApp app) : IClassFixture<MvcApp>
{
    // rb:test query.one
    [Fact]
    [Trait("corpus", "query.one")]
    public async Task One_value_is_bound_as_an_integer_and_echoed()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/query/one?page=417");

        await Answer.Is(Expected.WithEcho("items.small.json", new() { ["page"] = 417 }), response);
    }

    // rb:test query.many
    [Fact]
    [Trait("corpus", "query.many")]
    public async Task Eight_values_are_decoded_bound_and_echoed()
    {
        const string query = "page=417&size=38&status=paid&category=garden&sort=created&q=alpha%20bravo&minPrice=1200&maxPrice=34000";

        using HttpResponseMessage response = await app.CreateClient().GetAsync($"/query/many?{query}");

        await Answer.Is(Expected.WithEcho("items.small.json", Search()), response);
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
