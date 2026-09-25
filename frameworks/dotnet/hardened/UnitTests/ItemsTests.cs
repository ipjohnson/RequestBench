namespace UnitTests;

public class ItemsTests
{
    private static JsonNode Row(int id) => Expected.Json("items.large.json")["items"]![id - 1]!;

    // rb:test items.read
    [ModuleTest]
    [Trait("corpus", "items.read")]
    public async Task A_row_is_read_by_its_id(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/items/17");

        response.Assert.Ok();
        await Answer.Is(Row(17), response);
    }

    // rb:test items.head
    [ModuleTest]
    [Trait("corpus", "items.head")]
    public async Task Head_answers_the_headers_alone(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("HEAD", null, "/items/17");

        response.Assert.Ok();
        Assert.StartsWith("application/json", Answer.Header(response, "Content-Type"));
        Assert.Equal(0, response.Body.Length);
    }

    // rb:test items.create
    [ModuleTest]
    [Trait("corpus", "items.create")]
    public async Task Create_answers_the_next_id_and_its_location(ITestWebApp app)
    {
        JsonNode item = Expected.Json("items.new.json");
        int next = (int)Expected.Json("items.large.json")["count"]! + 1;

        TestWebResponse response = await app.Request("POST", null, "/items", request => request.RawBody(item.ToJsonString()));

        Assert.Equal(201, response.StatusCode);
        Assert.Equal($"/items/{next}", Answer.Header(response, "Location"));
        JsonObject created = item.DeepClone().AsObject();
        created.Insert(0, "id", next);
        await Answer.Is(created, response);
    }

    // rb:test items.replace
    [ModuleTest]
    [Trait("corpus", "items.replace")]
    public async Task Replace_answers_the_body_under_the_path_id(ITestWebApp app)
    {
        JsonNode item = Expected.Json("items.new.json");

        TestWebResponse response = await app.Request("PUT", null, "/items/17", request => request.RawBody(item.ToJsonString()));

        response.Assert.Ok();
        JsonObject replaced = item.DeepClone().AsObject();
        replaced.Insert(0, "id", 17);
        await Answer.Is(replaced, response);
    }

    // rb:test items.update
    [ModuleTest]
    [Trait("corpus", "items.update")]
    public async Task Update_answers_the_row_with_the_patch_applied(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("PATCH", null, "/items/17", request => request.RawBody("""{"priceCents":1999,"inStock":false}"""));

        response.Assert.Ok();
        JsonObject patched = Row(17).DeepClone().AsObject();
        patched["priceCents"] = 1999;
        patched["inStock"] = false;
        await Answer.Is(patched, response);
    }

    // rb:test items.delete
    [ModuleTest]
    [Trait("corpus", "items.delete")]
    public async Task Delete_answers_no_content(ITestWebApp app)
    {
        TestWebResponse response = await app.Delete("/items/17");

        Assert.Equal(204, response.StatusCode);
        Assert.Equal(0, response.Body.Length);
    }

    [ModuleTest]
    public async Task A_write_to_a_row_that_is_not_there_is_not_found(ITestWebApp app)
    {
        (await app.Delete("/items/999999")).Assert.NotFound();
    }
}
