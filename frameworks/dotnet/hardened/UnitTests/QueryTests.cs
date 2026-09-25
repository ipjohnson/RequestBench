namespace UnitTests;

public class QueryTests
{
    // rb:test query.one
    [ModuleTest]
    [Trait("corpus", "query.one")]
    public async Task One_value_is_bound_and_echoed(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/query/one?page=123");

        await Answer.Is(Expected.WithEcho("items.small.json", new JsonObject { ["page"] = 123 }), response);
    }

    // rb:test query.many
    [ModuleTest]
    [Trait("corpus", "query.many")]
    public async Task Eight_values_are_bound_into_one_model(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/query/many?page=123&size=45&status=paid&category=garden&sort=total&q=brass%20lamp&minPrice=1000&maxPrice=20000");

        await Answer.Is(Expected.WithEcho("items.small.json", new JsonObject
        {
            ["page"] = 123, ["size"] = 45, ["status"] = "paid", ["category"] = "garden",
            ["sort"] = "total", ["q"] = "brass lamp", ["minPrice"] = 1000, ["maxPrice"] = 20000,
        }), response);
    }

    [ModuleTest]
    public async Task A_missing_value_is_refused(ITestWebApp app)
    {
        (await app.Get("/query/many?page=123")).Assert.BadRequest();
    }
}
