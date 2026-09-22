using System.Net.Http.Headers;
using System.Text.Json;
using FastEndpoints;
using Implementation;
using Implementation.Endpoints;

namespace UnitTests;

public sealed class BodyTests(App app) : TestBase<App>
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

        using HttpResponseMessage response = await app.Client.PostAsync(path, Json(body), Cancellation);

        JsonNode order = Expected.Json(file);
        JsonObject bound = new()
        {
            ["fields"] = 2 + (2 * order["lines"]!.AsArray().Count),
            ["bytes"] = body.Length,
            ["echo"] = order.DeepClone(),
        };
        await Answer.IsAsync(bound, response);
    }

    // rb:test body.rejected_all
    [Fact]
    [Trait("corpus", "body.rejected_all")]
    public async Task The_validator_refuses_order_invalid_naming_every_rule_it_breaks()
    {
        (HttpResponseMessage response, ErrorResponse refused) =
            await app.Client.POSTAsync<ValidateSmallEndpoint, CheckedOrder, ErrorResponse>(Invalid<CheckedOrder>());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["customerId", "status", "lines"], refused.Errors.Keys);
    }

    // rb:test body.rejected_first
    [Fact]
    [Trait("corpus", "body.rejected_first")]
    public async Task The_first_error_validator_stops_at_the_first_rule()
    {
        (HttpResponseMessage response, ErrorResponse refused) =
            await app.Client.POSTAsync<ValidateFirstErrorEndpoint, FirstErrorOrder, ErrorResponse>(Invalid<FirstErrorOrder>());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["customerId"], refused.Errors.Keys);
    }

    [Fact]
    public async Task A_bad_line_is_named_by_its_index()
    {
        byte[] body = """{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}"""u8.ToArray();

        using HttpResponseMessage response = await app.Client.PostAsync("/body/validate/small", Json(body), Cancellation);

        Assert.Equal(["lines[0].qty"], Named(await Answer.JsonAsync(response)));
    }

    [Fact]
    public async Task A_bind_route_runs_no_validator()
    {
        using HttpResponseMessage response = await app.Client.PostAsync("/body/bind/small", Json(Expected.Bytes("order.invalid.json")), Cancellation);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("/body/validate/small")]
    [InlineData("/body/validate/first-error")]
    public async Task The_serializer_refuses_a_value_of_the_wrong_type_before_the_validator_runs(string path)
    {
        byte[] body = """{"customerId":"not-an-int","status":42,"lines":"nope"}"""u8.ToArray();

        using HttpResponseMessage response = await app.Client.PostAsync(path, Json(body), Cancellation);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["customerId"], Named(await Answer.JsonAsync(response)));
    }

    private static ByteArrayContent Json(byte[] body) => new(body) { Headers = { ContentType = new MediaTypeHeaderValue("application/json") } };

    private static string[] Named(JsonNode refused) => [.. refused["errors"]!.AsObject().Select(e => e.Key)];

    /// <summary>order.invalid, read into the request type a route binds.</summary>
    private static T Invalid<T>() => JsonSerializer.Deserialize<T>(Expected.Bytes("order.invalid.json"), JsonSerializerOptions.Web)!;
}
