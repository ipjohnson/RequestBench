namespace UnitTests;

/// <summary>
/// errors: every refusal is Wolverine's or ASP.NET Core's own. The Implementation adds no
/// ProblemDetails service and no status code pages, so only Wolverine's refusal of a body it
/// cannot read carries a body.
/// </summary>
[Collection(nameof(WolverineApp))]
public sealed class ErrorsTests(WolverineApp app)
{
    // rb:test errors.unmatched
    [Fact]
    [Trait("corpus", "errors.unmatched")]
    public async Task A_path_no_route_matches_is_the_routers_404_with_no_body()
    {
        IScenarioResult result = await Ask(s => s.Get.Url("/errors/unmatched"), HttpStatusCode.NotFound);

        Assert.Empty(Answer.Bytes(result));
    }

    // rb:test errors.not_found
    [Fact]
    [Trait("corpus", "errors.not_found")]
    public async Task An_id_with_no_row_is_answered_404_because_the_endpoint_returned_null()
    {
        IScenarioResult result = await Ask(s => s.Get.Url("/items/999999"), HttpStatusCode.NotFound);

        Assert.Empty(Answer.Bytes(result));
    }

    // rb:test errors.wrong_method
    [Fact]
    [Trait("corpus", "errors.wrong_method")]
    public async Task A_method_the_path_has_no_route_for_is_405()
    {
        IScenarioResult result = await Ask(s => s.Post.Url("/items/17"), HttpStatusCode.MethodNotAllowed);

        Assert.Equal(["DELETE", "GET", "HEAD", "PATCH", "PUT"], Answer.Header(result, "allow")!.Split(", ").Order());
    }

    // rb:test errors.malformed
    [Fact]
    [Trait("corpus", "errors.malformed")]
    public async Task A_body_that_is_not_json_is_wolverines_400()
    {
        IScenarioResult result = await Ask(
            s => s.Post.ByteArray("""{"customerId": 1, "lines": ["""u8.ToArray()).ContentType("application/json").ToUrl("/body/validate/small"),
            HttpStatusCode.BadRequest);

        Assert.Equal("application/problem+json", result.Context.Response.ContentType);
        JsonNode problem = Answer.Json(result);
        Assert.Equal("Invalid JSON format", (string?)problem["title"]);
        Assert.Equal(400, (int?)problem["status"]);
    }

    private Task<IScenarioResult> Ask(Action<Scenario> request, HttpStatusCode status) => app.Host.Scenario(s =>
    {
        request(s);
        s.StatusCodeShouldBe(status);
    });
}
