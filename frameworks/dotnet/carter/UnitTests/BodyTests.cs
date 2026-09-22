using System.Net.Http.Headers;

namespace UnitTests;

public sealed class BodyTests(CarterApp app) : IClassFixture<CarterApp>
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

    // rb:test body.rejected_all
    [Fact]
    [Trait("corpus", "body.rejected_all")]
    public async Task Carters_filter_refuses_order_invalid_naming_every_rule_it_breaks()
    {
        using HttpResponseMessage response = await app.CreateClient().PostAsync("/body/validate/small", Json(Expected.Bytes("order.invalid.json")));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal(["CustomerId", "Status", "Lines"], Named(await Answer.Json(response)));
    }

    // rb:test body.rejected_first
    [Fact]
    [Trait("corpus", "body.rejected_first")]
    public async Task The_first_error_route_stops_at_the_first_rule()
    {
        using HttpResponseMessage response = await app.CreateClient().PostAsync("/body/validate/first-error", Json(Expected.Bytes("order.invalid.json")));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal(["CustomerId"], Named(await Answer.Json(response)));
    }

    [Fact]
    public async Task A_bad_line_is_named_by_its_index()
    {
        byte[] body = """{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}"""u8.ToArray();

        using HttpResponseMessage response = await app.CreateClient().PostAsync("/body/validate/small", Json(body));

        Assert.Equal(["Lines[0].Qty"], Named(await Answer.Json(response)));
    }

    [Theory]
    [InlineData("/body/validate/small")]
    [InlineData("/body/validate/first-error")]
    public async Task The_binder_refuses_a_value_of_the_wrong_type_before_the_filter_and_names_no_field(string path)
    {
        byte[] body = """{"customerId":"not-an-int","status":42,"lines":"nope"}"""u8.ToArray();

        using HttpResponseMessage response = await app.CreateClient().PostAsync(path, Json(body));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        JsonNode problem = await Answer.Json(response);
        Assert.Equal(400, (int?)problem["status"]);
        Assert.Null(problem["errors"]);
    }

    private static ByteArrayContent Json(byte[] body) => new(body) { Headers = { ContentType = new MediaTypeHeaderValue("application/json") } };

    private static string[] Named(JsonNode problem) =>
        [.. problem["errors"]!.AsArray().Select(e => (string)e!["propertyName"]!)];
}
