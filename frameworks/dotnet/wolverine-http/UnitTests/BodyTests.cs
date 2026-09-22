namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class BodyTests(WolverineApp app)
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

        IScenarioResult result = await Post(path, body, HttpStatusCode.OK);

        JsonNode order = Expected.Json(file);
        JsonObject bound = new()
        {
            ["fields"] = 2 + (2 * order["lines"]!.AsArray().Count),
            ["bytes"] = body.Length,
            ["echo"] = order.DeepClone(),
        };
        Answer.Is(bound, result);
    }

    [Fact]
    public async Task A_bind_route_runs_no_validator()
    {
        byte[] body = Expected.Bytes("order.invalid.json");

        IScenarioResult result = await Post("/body/bind/small", body, HttpStatusCode.OK);

        Assert.Equal(0, (int?)Answer.Json(result)["echo"]!["customerId"]);
    }

    // rb:test body.rejected_all
    [Fact]
    [Trait("corpus", "body.rejected_all")]
    public async Task Wolverines_middleware_refuses_order_invalid_naming_every_rule_it_breaks()
    {
        IScenarioResult result = await Post("/body/validate/small", Expected.Bytes("order.invalid.json"), HttpStatusCode.BadRequest);

        Assert.Equal(["CustomerId", "Status", "Lines"], Named(Answer.Json(result)));
    }

    // rb:test body.rejected_first
    [Fact]
    [Trait("corpus", "body.rejected_first")]
    public async Task The_first_error_route_stops_at_the_first_rule()
    {
        IScenarioResult result = await Post("/body/validate/first-error", Expected.Bytes("order.invalid.json"), HttpStatusCode.BadRequest);

        Assert.Equal(["CustomerId"], Named(Answer.Json(result)));
    }

    [Fact]
    public async Task A_bad_line_is_named_by_its_index()
    {
        byte[] body = """{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}"""u8.ToArray();

        IScenarioResult result = await Post("/body/validate/small", body, HttpStatusCode.BadRequest);

        Assert.Equal(["Lines[0].Qty"], Named(Answer.Json(result)));
    }

    [Theory]
    [InlineData("/body/validate/small")]
    [InlineData("/body/validate/first-error")]
    public async Task A_value_of_the_wrong_type_is_refused_before_the_validator_and_names_no_field(string path)
    {
        byte[] body = """{"customerId":"not-an-int","status":42,"lines":"nope"}"""u8.ToArray();

        IScenarioResult result = await Post(path, body, HttpStatusCode.BadRequest);

        JsonNode problem = Answer.Json(result);
        Assert.Equal("Invalid JSON format", (string?)problem["title"]);
        Assert.Null(problem["errors"]);
    }

    private Task<IScenarioResult> Post(string path, byte[] body, HttpStatusCode status) => app.Host.Scenario(s =>
    {
        s.Post.ByteArray(body).ContentType("application/json").ToUrl(path);
        s.StatusCodeShouldBe(status);
    });

    private static string[] Named(JsonNode problem) => [.. problem["errors"]!.AsObject().Select(e => e.Key)];
}
