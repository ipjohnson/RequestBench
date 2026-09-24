using System.Globalization;

namespace UnitTests;

public class BodyTests
{
    // rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
    [HardenedTest]
    [Trait("corpus", "body.bind_small")]
    [Trait("corpus", "body.bind_medium")]
    [Trait("corpus", "body.validate_small")]
    [Trait("corpus", "body.validate_medium")]
    [InlineData("/body/bind/small", "order.small.json")]
    [InlineData("/body/bind/medium", "order.medium.json")]
    [InlineData("/body/validate/small", "order.small.json")]
    [InlineData("/body/validate/medium", "order.medium.json")]
    public async Task An_order_is_answered_with_its_leaves_its_length_and_itself(string path, string file, ITestWebApp app)
    {
        byte[] body = Expected.Bytes(file);

        TestWebResponse response = await app.Request("POST", null, path, request => Json(request, body));

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
    [HardenedTest]
    [Trait("corpus", "body.rejected_all")]
    public async Task Order_invalid_is_refused_naming_every_rule_it_breaks(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("POST", null, "/body/validate/small", request => Json(request, Expected.Bytes("order.invalid.json")));

        response.Assert.BadRequest();
        Assert.Equal(["order.customerId", "order.status", "order.lines"], Named(await Answer.Json(response)));
    }

    // rb:test body.rejected_first
    [HardenedTest]
    [Trait("corpus", "body.rejected_first")]
    public async Task The_first_error_route_stops_at_the_first_rule(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("POST", null, "/body/validate/first-error", request => Json(request, Expected.Bytes("order.invalid.json")));

        response.Assert.BadRequest();
        Assert.Equal(["order.customerId"], Named(await Answer.Json(response)));
    }

    [HardenedTest]
    public async Task A_bad_line_is_named_by_its_index(ITestWebApp app)
    {
        byte[] body = """{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}"""u8.ToArray();

        TestWebResponse response = await app.Request("POST", null, "/body/validate/small", request => Json(request, body));

        Assert.Equal(["order.lines[0].qty"], Named(await Answer.Json(response)));
    }

    [HardenedTest]
    public async Task A_bind_route_checks_no_rule(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("POST", null, "/body/bind/small", request => Json(request, Expected.Bytes("order.invalid.json")));

        response.Assert.Ok();
    }

    /// <summary>The body as a client sends it, with the length the handler binds.</summary>
    private static void Json(TestWebRequest request, byte[] body)
    {
        request.RawBody(body, "application/json");
        request.Headers["Content-Length"] = body.Length.ToString(CultureInfo.InvariantCulture);
    }

    private static string[] Named(JsonNode refusal) => [.. refusal["errors"]!.AsArray().Select(e => (string)e!["field"]!)];
}
