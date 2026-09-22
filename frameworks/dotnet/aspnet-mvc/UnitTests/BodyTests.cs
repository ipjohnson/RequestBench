using System.Net.Http.Headers;

namespace UnitTests;

public sealed class BodyTests(MvcApp app) : IClassFixture<MvcApp>
{
    // rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
    [Theory]
    [Trait("corpus", "body.bind_small")]
    [Trait("corpus", "body.bind_medium")]
    [Trait("corpus", "body.validate_small")]
    [Trait("corpus", "body.validate_medium")]
    [InlineData("/body/bind/small", "order.small.json")]
    [InlineData("/body/bind/medium", "order.medium.json")]
    [InlineData("/body/validate/small", "order.small.json")]
    [InlineData("/body/validate/medium", "order.medium.json")]
    public async Task An_order_is_answered_with_its_leaves_its_length_and_itself(string path, string file)
    {
        byte[] body = Expected.Bytes(file);

        using HttpResponseMessage response = await app.CreateClient().PostAsync(path, Json(body));

        JsonNode order = Expected.Json(file);
        JsonObject bound = new()
        {
            ["fields"] = 2 + (2 * order["lines"]!.AsArray().Count),
            ["bytes"] = body.Length,
            ["echo"] = order.DeepClone(),
        };
        await Answer.Is(bound, response);
    }

    [Theory]
    [InlineData("/body/bind/small")]
    [InlineData("/body/bind/medium")]
    public async Task The_bind_actions_validate_nothing(string path)
    {
        using HttpResponseMessage response = await app.CreateClient().PostAsync(path, Json(Expected.Bytes("order.invalid.json")));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // rb:test body.rejected_all
    [Fact]
    [Trait("corpus", "body.rejected_all")]
    public async Task ApiController_refuses_order_invalid_naming_every_property_it_breaks()
    {
        using HttpResponseMessage response = await app.CreateClient().PostAsync("/body/validate/small", Json(Expected.Bytes("order.invalid.json")));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["CustomerId", "Lines", "Status"], Named(await Answer.Json(response)).Order(StringComparer.Ordinal));
    }

    // rb:test body.rejected_first
    [Fact]
    [Trait("corpus", "body.rejected_first")]
    public async Task The_first_error_route_stops_at_the_first_property()
    {
        using HttpResponseMessage response = await app.CreateClient().PostAsync("/body/validate/first-error", Json(Expected.Bytes("order.invalid.json")));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["CustomerId"], Named(await Answer.Json(response)));
    }

    [Fact]
    public async Task The_first_error_refusal_is_the_automatic_one_cut_to_its_first_entry()
    {
        HttpClient client = app.CreateClient();
        using HttpResponseMessage all = await client.PostAsync("/body/validate/small", Json(Expected.Bytes("order.invalid.json")));
        using HttpResponseMessage first = await client.PostAsync("/body/validate/first-error", Json(Expected.Bytes("order.invalid.json")));

        JsonObject whole = (await Answer.Json(all)).AsObject();
        JsonObject cut = (await Answer.Json(first)).AsObject();
        Assert.Equal(all.Content.Headers.ContentType?.ToString(), first.Content.Headers.ContentType?.ToString());
        Assert.True(JsonNode.DeepEquals(whole["errors"]!["CustomerId"], cut["errors"]!["CustomerId"]));
        foreach (string name in new[] { "type", "title", "status" })
        {
            Assert.True(JsonNode.DeepEquals(whole[name], cut[name]), name);
        }
    }

    [Theory]
    [InlineData("/body/validate/small", new[] { "Lines[0].Qty" })]
    [InlineData("/body/validate/first-error", new[] { "Lines[0].Qty" })]
    public async Task A_bad_line_is_named_by_its_index(string path, string[] named)
    {
        byte[] body = """{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}"""u8.ToArray();

        using HttpResponseMessage response = await app.CreateClient().PostAsync(path, Json(body));

        Assert.Equal(named, Named(await Answer.Json(response)));
    }

    [Fact]
    public async Task The_first_error_route_reads_a_line_in_declaration_order()
    {
        byte[] body = """{"customerId":1,"status":"open","lines":[{"productId":1,"qty":1},{"productId":0,"qty":0}]}"""u8.ToArray();

        using HttpResponseMessage response = await app.CreateClient().PostAsync("/body/validate/first-error", Json(body));

        Assert.Equal(["Lines[1].ProductId"], Named(await Answer.Json(response)));
    }

    [Theory]
    [InlineData("/body/validate/small")]
    [InlineData("/body/validate/first-error")]
    public async Task A_value_of_the_wrong_type_is_refused_by_the_input_formatter_at_its_json_path(string path)
    {
        byte[] body = """{"customerId":"not-an-int","status":"open","lines":[]}"""u8.ToArray();

        using HttpResponseMessage response = await app.CreateClient().PostAsync(path, Json(body));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("$.customerId", Named(await Answer.Json(response)));
    }

    private static ByteArrayContent Json(byte[] body) => new(body) { Headers = { ContentType = new MediaTypeHeaderValue("application/json") } };

    private static string[] Named(JsonNode problem) => [.. problem["errors"]!.AsObject().Select(e => e.Key)];
}
