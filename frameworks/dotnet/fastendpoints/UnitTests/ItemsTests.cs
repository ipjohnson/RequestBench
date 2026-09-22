namespace UnitTests;

public sealed class ItemsTests(App app) : TestBase<App>
{
    // rb:test items.read
    [Fact]
    [Trait("corpus", "items.read")]
    public async Task A_row_is_read_by_the_id_in_the_path()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/items/17", Cancellation);

        await Answer.IsAsync(Row(17), response);
    }

    // rb:test items.head
    [Fact]
    [Trait("corpus", "items.head")]
    public async Task Head_is_answered_by_the_read_endpoint()
    {
        // Kestrel leaves a HEAD answer's body unwritten. The test host does not, so the body is not checked.
        using HttpResponseMessage response = await app.Client.SendAsync(new(HttpMethod.Head, "/items/17"), Cancellation);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }

    // rb:test items.create
    [Fact]
    [Trait("corpus", "items.create")]
    public async Task A_created_item_is_the_row_after_the_last_where_the_read_endpoint_finds_it()
    {
        using HttpResponseMessage response = await app.Client.PostAsync("/items", New(), Cancellation);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("/items/1426", response.Headers.Location?.OriginalString);
        await Answer.IsAsync(Numbered(1426), response);
    }

    // rb:test items.replace
    [Fact]
    [Trait("corpus", "items.replace")]
    public async Task A_replaced_item_takes_the_id_in_the_path()
    {
        using HttpResponseMessage response = await app.Client.PutAsync("/items/17", New(), Cancellation);

        await Answer.IsAsync(Numbered(17), response);
    }

    // rb:test items.update
    [Fact]
    [Trait("corpus", "items.update")]
    public async Task A_patch_is_merged_onto_the_row()
    {
        using HttpResponseMessage response = await app.Client.PatchAsync("/items/17", new ByteArrayContent(Expected.Bytes("items.patch.json"))
        {
            Headers = { ContentType = new("application/json") },
        }, Cancellation);

        JsonObject merged = Row(17).AsObject();
        foreach ((string name, JsonNode? value) in Expected.Json("items.patch.json").AsObject())
        {
            merged[name] = value?.DeepClone();
        }
        await Answer.IsAsync(merged, response);
    }

    // rb:test items.delete
    [Fact]
    [Trait("corpus", "items.delete")]
    public async Task A_delete_is_answered_204_with_no_body()
    {
        using HttpResponseMessage response = await app.Client.DeleteAsync("/items/17", Cancellation);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty(await Answer.BytesAsync(response));
    }

    [Fact]
    public async Task An_id_that_is_not_an_integer_matches_no_route()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/items/seventeen", Cancellation);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
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

    private static ByteArrayContent New() => new(Expected.Bytes("items.new.json")) { Headers = { ContentType = new("application/json") } };
}
