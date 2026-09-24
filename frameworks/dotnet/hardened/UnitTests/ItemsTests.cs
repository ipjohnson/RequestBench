namespace UnitTests;

public class ItemsTests
{
    // rb:test items.read
    [HardenedTest]
    [Trait("corpus", "items.read")]
    public async Task A_row_is_read_by_the_id_in_the_path(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/items/17");

        await Answer.Is(Row(17), response);
    }

    // rb:test items.head
    [HardenedTest]
    [Trait("corpus", "items.head")]
    public async Task Head_is_answered_by_the_get_route_with_no_body(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("HEAD", null, "/items/17");

        response.Assert.Ok();
        Assert.Equal("application/json", Answer.Header(response, "content-type"));
        Assert.Empty(await response.ReadTextAsync());
    }

    // rb:test items.create
    [HardenedTest]
    [Trait("corpus", "items.create")]
    public async Task A_created_item_is_the_row_after_the_last(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("POST", null, "/items", New);

        Assert.Equal(201, response.StatusCode);
        Assert.Equal("/items/1426", Answer.Header(response, "location"));
        await Answer.Is(Numbered(1426), response);
    }

    // rb:test items.replace
    [HardenedTest]
    [Trait("corpus", "items.replace")]
    public async Task A_replaced_item_takes_the_id_in_the_path(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("PUT", null, "/items/17", New);

        await Answer.Is(Numbered(17), response);
    }

    // rb:test items.update
    [HardenedTest]
    [Trait("corpus", "items.update")]
    public async Task A_patch_is_merged_onto_the_row(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("PATCH", null, "/items/17", request => request.RawBody(Expected.Bytes("items.patch.json"), "application/json"));

        JsonObject merged = Row(17).AsObject();
        foreach ((string name, JsonNode? value) in Expected.Json("items.patch.json").AsObject())
        {
            merged[name] = value?.DeepClone();
        }
        await Answer.Is(merged, response);
    }

    // rb:test items.delete
    [HardenedTest]
    [Trait("corpus", "items.delete")]
    public async Task A_delete_is_answered_204_with_no_body(ITestWebApp app)
    {
        TestWebResponse response = await app.Delete("/items/17");

        Assert.Equal(204, response.StatusCode);
        Assert.Empty(await response.ReadTextAsync());
    }

    [HardenedTest]
    public async Task An_id_that_is_not_an_integer_matches_no_route(ITestWebApp app)
    {
        (await app.Get("/items/abc")).Assert.NotFound();
    }

    private static JsonNode Row(int id) => Expected.Json("items.large.json")["items"]![id - 1]!.DeepClone();

    private static JsonObject Numbered(int id)
    {
        JsonObject item = new() { ["id"] = id };
        foreach ((string name, JsonNode? value) in Expected.Json("items.new.json").AsObject())
        {
            item[name] = value?.DeepClone();
        }
        return item;
    }

    private static void New(TestWebRequest request) => request.RawBody(Expected.Bytes("items.new.json"), "application/json");
}
