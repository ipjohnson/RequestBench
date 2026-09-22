namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class ItemsTests(WolverineApp app)
{
    // rb:test items.read
    [Fact]
    [Trait("corpus", "items.read")]
    public async Task A_row_is_read_by_the_id_in_the_path()
    {
        IScenarioResult result = await app.Host.Scenario(s => s.Get.Url("/items/17"));

        Answer.Is(Row(17), result);
    }

    // rb:test items.head
    [Fact]
    [Trait("corpus", "items.head")]
    public async Task Head_is_answered_by_its_own_route()
    {
        await app.Host.Scenario(s =>
        {
            s.Head.Url("/items/17");
            s.StatusCodeShouldBeOk();
            s.ContentTypeShouldBe("application/json; charset=utf-8");
        });
    }

    // rb:test items.create
    [Fact]
    [Trait("corpus", "items.create")]
    public async Task A_created_item_is_the_row_after_the_last()
    {
        IScenarioResult result = await app.Host.Scenario(s =>
        {
            s.Post.ByteArray(Expected.Bytes("items.new.json")).ContentType("application/json").ToUrl("/items");
            s.StatusCodeShouldBe(HttpStatusCode.Created);
            s.Header("location").SingleValueShouldEqual("/items/1426");
        });

        Answer.Is(Numbered(1426), result);
    }

    // rb:test items.replace
    [Fact]
    [Trait("corpus", "items.replace")]
    public async Task A_replaced_item_takes_the_id_in_the_path()
    {
        IScenarioResult result = await app.Host.Scenario(s => s.Put.ByteArray(Expected.Bytes("items.new.json")).ContentType("application/json").ToUrl("/items/17"));

        Answer.Is(Numbered(17), result);
    }

    // rb:test items.update
    [Fact]
    [Trait("corpus", "items.update")]
    public async Task A_patch_is_merged_onto_the_row()
    {
        IScenarioResult result = await app.Host.Scenario(s => s.Patch.ByteArray(Expected.Bytes("items.patch.json")).ContentType("application/json").ToUrl("/items/17"));

        JsonObject merged = Row(17).AsObject();
        foreach ((string name, JsonNode? value) in Expected.Json("items.patch.json").AsObject())
        {
            merged[name] = value?.DeepClone();
        }
        Answer.Is(merged, result);
    }

    // rb:test items.delete
    [Fact]
    [Trait("corpus", "items.delete")]
    public async Task A_delete_is_answered_204_with_no_body()
    {
        IScenarioResult result = await app.Host.Scenario(s =>
        {
            s.Delete.Url("/items/17");
            s.StatusCodeShouldBe(HttpStatusCode.NoContent);
        });

        Assert.Empty(Answer.Bytes(result));
    }

    [Theory]
    [InlineData("PATCH")]
    [InlineData("DELETE")]
    public async Task A_write_to_a_row_that_does_not_exist_is_404(string method)
    {
        await app.Host.Scenario(s =>
        {
            if (method == "PATCH")
            {
                s.Patch.ByteArray(Expected.Bytes("items.patch.json")).ContentType("application/json").ToUrl("/items/999999");
            }
            else
            {
                s.Delete.Url("/items/999999");
            }
            s.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });
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
}
