namespace UnitTests;

/// <summary>
/// errors: every refusal is ASP.NET Core's own, written as ProblemDetails. Routing's 404 and 405
/// get theirs from AddProblemDetails, and [ApiController] writes its own for the action's
/// NotFound and for a body it cannot read.
/// </summary>
public sealed class ErrorsTests(MvcApp app) : IClassFixture<MvcApp>
{
    // rb:test errors.unmatched
    [Fact]
    [Trait("corpus", "errors.unmatched")]
    public async Task A_path_no_route_matches_is_the_routers_404()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/errors/unmatched");

        await Problem(HttpStatusCode.NotFound, response);
    }

    // rb:test errors.not_found
    [Fact]
    [Trait("corpus", "errors.not_found")]
    public async Task An_id_with_no_row_is_the_actions_404()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/items/999999");

        await Problem(HttpStatusCode.NotFound, response);
    }

    // rb:test errors.wrong_method
    [Fact]
    [Trait("corpus", "errors.wrong_method")]
    public async Task A_method_the_path_has_no_action_for_is_405()
    {
        using HttpResponseMessage response = await app.CreateClient().PostAsync("/items/17", null);

        await Problem(HttpStatusCode.MethodNotAllowed, response);
        Assert.Equal("DELETE, GET, HEAD, PATCH, PUT", Answer.Header(response, "allow"));
    }

    // rb:test errors.malformed
    [Fact]
    [Trait("corpus", "errors.malformed")]
    public async Task A_body_that_is_not_json_is_the_automatic_400()
    {
        using HttpResponseMessage response = await app.CreateClient().PostAsync("/body/validate/small", new StringContent("""{"customerId": 1, "lines": [""", null, "application/json"));

        JsonNode problem = await Problem(HttpStatusCode.BadRequest, response);
        Assert.Equal(["$.lines[0]", "order"], problem["errors"]!.AsObject().Select(e => e.Key).Order(StringComparer.Ordinal));
    }

    private static async Task<JsonNode> Problem(HttpStatusCode status, HttpResponseMessage response)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        JsonNode problem = await Answer.Json(response);
        Assert.Equal((int)status, (int?)problem["status"]);
        return problem;
    }
}
