namespace UnitTests;

/// <summary>
/// errors: routing's own 404 and 405, a handler's Send.NotFoundAsync, and FastEndpoints'
/// ErrorResponse for a body its serializer cannot read. Nothing adds a body to the first three.
/// </summary>
public sealed class ErrorsTests(App app) : TestBase<App>
{
    // rb:test errors.unmatched
    [Fact]
    [Trait("corpus", "errors.unmatched")]
    public async Task A_path_no_route_matches_is_the_routers_404_with_no_body()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/errors/unmatched", Cancellation);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(await Answer.BytesAsync(response));
    }

    // rb:test errors.not_found
    [Fact]
    [Trait("corpus", "errors.not_found")]
    public async Task An_id_with_no_row_is_the_handlers_404_with_no_body()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/items/999999", Cancellation);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(await Answer.BytesAsync(response));
    }

    // rb:test errors.wrong_method
    [Fact]
    [Trait("corpus", "errors.wrong_method")]
    public async Task A_method_the_path_has_no_route_for_is_405_naming_the_ones_it_has()
    {
        using HttpResponseMessage response = await app.Client.PostAsync("/items/17", null, Cancellation);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        Assert.Equal(["DELETE", "GET", "HEAD", "PATCH", "PUT"], response.Content.Headers.Allow.Order());
        Assert.Empty(await Answer.BytesAsync(response));
    }

    // rb:test errors.malformed
    [Fact]
    [Trait("corpus", "errors.malformed")]
    public async Task A_body_that_is_not_json_is_the_serializers_400_naming_where_it_stopped()
    {
        using HttpResponseMessage response = await app.Client.PostAsync("/body/validate/small", new StringContent("""{"customerId": 1, "lines": [""", null, "application/json"), Cancellation);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        JsonNode refused = await Answer.JsonAsync(response);
        Assert.Equal(400, (int?)refused["statusCode"]);
        Assert.Equal(["lines[0]"], refused["errors"]!.AsObject().Select(e => e.Key));
    }
}
