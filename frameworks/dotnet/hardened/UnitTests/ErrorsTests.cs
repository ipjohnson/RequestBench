namespace UnitTests;

public class ErrorsTests
{
    // rb:test errors.unmatched
    [ModuleTest]
    [Trait("corpus", "errors.unmatched")]
    public async Task A_path_with_no_route_is_not_found(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/errors/unmatched");

        response.Assert.NotFound();
        Assert.Empty(await response.ReadTextAsync());
    }

    // rb:test errors.wrong_method
    [ModuleTest]
    [Trait("corpus", "errors.wrong_method")]
    public async Task A_method_the_path_lacks_is_not_allowed(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("POST", null, "/items/17");

        Assert.Equal(405, response.StatusCode);
        Assert.Equal("DELETE, GET, HEAD, PATCH, PUT", Answer.Header(response, "Allow"));
    }

    // rb:test errors.not_found
    [ModuleTest]
    [Trait("corpus", "errors.not_found")]
    public async Task A_row_that_is_not_there_is_not_found(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/items/999999");

        response.Assert.NotFound();
        Assert.Equal("urn:hardened:problem:not-found", (string)(await Answer.Json(response))["type"]!);
    }

    // rb:test errors.malformed
    [ModuleTest]
    [Trait("corpus", "errors.malformed")]
    public async Task A_body_that_is_not_json_is_refused_by_the_binder(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("POST", null, "/body/validate/small", request => request.RawBody("""{"customerId": 1, "lines": ["""));

        response.Assert.BadRequest();
        JsonNode error = (await Answer.Json(response))["errors"]![0]!;
        Assert.Equal("order", (string)error["field"]!);
        Assert.Equal("invalid", (string)error["code"]!);
    }
}
