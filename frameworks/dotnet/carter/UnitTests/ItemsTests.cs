using System.Net.Http.Json;

namespace UnitTests;

public sealed class ItemsTests(CarterApp app) : IClassFixture<CarterApp>
{
    // rb:test items.read
    [Fact]
    [Trait("corpus", "items.read")]
    public async Task A_row_is_read_by_the_id_in_the_path()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/items/17");

        await Answer.Is(Row(17), response);
    }

    // rb:test items.head
    [Fact]
    [Trait("corpus", "items.head")]
    public async Task Head_is_answered_by_the_get_route()
    {
        using HttpResponseMessage response = await app.CreateClient().SendAsync(new(HttpMethod.Head, "/items/17"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }

    // rb:test items.create
    [Fact]
    [Trait("corpus", "items.create")]
    public async Task A_created_item_is_the_row_after_the_last()
    {
        using HttpResponseMessage response = await app.CreateClient().PostAsync("/items", New());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("/items/1426", response.Headers.Location?.OriginalString);
        await Answer.Is(Numbered(1426), response);
    }

    // rb:test items.replace
    [Fact]
    [Trait("corpus", "items.replace")]
    public async Task A_replaced_item_takes_the_id_in_the_path()
    {
        using HttpResponseMessage response = await app.CreateClient().PutAsync("/items/17", New());

        await Answer.Is(Numbered(17), response);
    }

    // rb:test items.update
    [Fact]
    [Trait("corpus", "items.update")]
    public async Task A_patch_is_merged_onto_the_row()
    {
        using HttpResponseMessage response = await app.CreateClient().PatchAsync("/items/17", new ByteArrayContent(Expected.Bytes("items.patch.json"))
        {
            Headers = { ContentType = new("application/json") },
        });

        JsonObject merged = Row(17).AsObject();
        foreach ((string name, JsonNode? value) in Expected.Json("items.patch.json").AsObject())
        {
            merged[name] = value?.DeepClone();
        }
        await Answer.Is(merged, response);
    }

    // rb:test items.delete
    [Fact]
    [Trait("corpus", "items.delete")]
    public async Task A_delete_is_answered_204_with_no_body()
    {
        using HttpResponseMessage response = await app.CreateClient().DeleteAsync("/items/17");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());
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
