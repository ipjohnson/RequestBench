using System.Globalization;

namespace UnitTests;

/// <summary>errors: every refusal is Hardened's own. Nothing in the Implementation shapes one.</summary>
public class ErrorsTests
{
    // rb:test errors.unmatched
    [HardenedTest]
    [Trait("corpus", "errors.unmatched")]
    public async Task A_path_no_route_matches_is_a_404_with_no_body(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/errors/unmatched");

        response.Assert.NotFound();
        Assert.Empty(await response.ReadTextAsync());
    }

    // rb:test errors.not_found
    [HardenedTest]
    [Trait("corpus", "errors.not_found")]
    public async Task An_id_with_no_row_is_the_handlers_NotFound(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/items/999999");

        response.Assert.NotFound();
        Assert.Equal("urn:hardened:problem:not-found", (string?)(await Answer.Json(response))["type"]);
    }

    // rb:test errors.wrong_method
    [HardenedTest]
    [Trait("corpus", "errors.wrong_method")]
    public async Task A_method_the_path_has_no_route_for_is_405_naming_the_ones_it_has(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("POST", null, "/items/17");

        Assert.Equal(405, response.StatusCode);
        Assert.Equal("DELETE, GET, HEAD, PATCH, PUT", Answer.Header(response, "allow"));
    }

    // rb:test errors.malformed
    [HardenedTest]
    [Trait("corpus", "errors.malformed")]
    public async Task A_body_that_is_not_json_is_refused_naming_the_body(ITestWebApp app)
    {
        byte[] body = """{"customerId": 1, "lines": ["""u8.ToArray();

        TestWebResponse response = await app.Request("POST", null, "/body/validate/small", request =>
        {
            request.RawBody(body, "application/json");
            request.Headers["Content-Length"] = body.Length.ToString(CultureInfo.InvariantCulture);
        });

        response.Assert.BadRequest();
        JsonNode error = (await Answer.Json(response))["errors"]![0]!;
        Assert.Equal(("order", "invalid"), ((string?)error["field"], (string?)error["code"]));
    }
}
