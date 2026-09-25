using Hardened.Web.Kestrel.Runtime;

namespace UnitTests;

/// <summary>
/// On a Kestrel socket, because a bind answer counts the Content-Length the request declared, and
/// the pipeline host sends a body without one.
/// </summary>
[KestrelRuntime]
public class BodyTests
{
    private const string Invalid = """{"customerId":0,"status":"","lines":[]}""";

    /// <summary>The order as the corpus sends it, with no whitespace, and what a bind row answers for it.</summary>
    private static (string Body, JsonNode Answer) Order(string size)
    {
        JsonNode order = Expected.Json($"order.{size}.json");
        string body = order.ToJsonString();
        int lines = order["lines"]!.AsArray().Count;
        return (body, new JsonObject { ["fields"] = 2 + (2 * lines), ["bytes"] = body.Length, ["echo"] = order.DeepClone() });
    }

    private static Task<TestWebResponse> Post(ITestWebApp app, string path, string body) =>
        app.Request("POST", null, path, request => request.RawBody(body));

    // rb:test body.bind_small,body.bind_medium
    [ModuleTest]
    [Trait("corpus", "body.bind_small")]
    [Trait("corpus", "body.bind_medium")]
    [InlineData("small")]
    [InlineData("medium")]
    public async Task The_order_is_bound_and_counted(string size, ITestWebApp app)
    {
        (string body, JsonNode answer) = Order(size);

        TestWebResponse response = await Post(app, $"/body/bind/{size}", body);

        response.Assert.Ok();
        await Answer.Is(answer, response);
    }

    [ModuleTest]
    public async Task The_bind_route_validates_nothing(ITestWebApp app)
    {
        (await Post(app, "/body/bind/small", Invalid)).Assert.Ok();
    }

    // rb:test body.validate_small,body.validate_medium
    [ModuleTest]
    [Trait("corpus", "body.validate_small")]
    [Trait("corpus", "body.validate_medium")]
    [InlineData("small")]
    [InlineData("medium")]
    public async Task A_valid_order_answers_as_the_bind_row(string size, ITestWebApp app)
    {
        (string body, JsonNode answer) = Order(size);

        TestWebResponse response = await Post(app, $"/body/validate/{size}", body);

        response.Assert.Ok();
        await Answer.Is(answer, response);
    }

    // rb:test body.rejected_all
    [ModuleTest]
    [Trait("corpus", "body.rejected_all")]
    public async Task Every_broken_rule_is_named(ITestWebApp app)
    {
        TestWebResponse response = await Post(app, "/body/validate/small", Invalid);

        response.Assert.BadRequest();
        JsonNode error = await Answer.Json(response);
        Assert.Equal("ValidationError", (string)error["type"]!);
        Assert.Equal(["order.customerId", "order.status", "order.lines"], error["errors"]!.AsArray().Select(e => (string)e!["field"]!));
    }

    // rb:test body.rejected_first
    [ModuleTest]
    [Trait("corpus", "body.rejected_first")]
    public async Task The_first_error_route_names_one_rule(ITestWebApp app)
    {
        TestWebResponse response = await Post(app, "/body/validate/first-error", Invalid);

        response.Assert.BadRequest();
        JsonNode error = await Answer.Json(response);
        Assert.Equal(["order.customerId"], error["errors"]!.AsArray().Select(e => (string)e!["field"]!));
    }

    [ModuleTest]
    public async Task A_bad_line_is_named_by_its_index(ITestWebApp app)
    {
        TestWebResponse response = await Post(app, "/body/validate/small", """{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}""");

        response.Assert.BadRequest();
        JsonNode error = await Answer.Json(response);
        Assert.Equal(["order.lines[0].qty"], error["errors"]!.AsArray().Select(e => (string)e!["field"]!));
    }
}
