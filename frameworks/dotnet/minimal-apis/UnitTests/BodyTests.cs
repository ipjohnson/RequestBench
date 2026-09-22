using System.Net.Http.Headers;
using System.Reflection;
using System.Text;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace UnitTests;

public sealed class BodyTests(MinimalApisApp app) : IClassFixture<MinimalApisApp>
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
    public async Task Validation_refuses_order_invalid_naming_every_rule_it_breaks()
    {
        using HttpResponseMessage response = await app.CreateClient().PostAsync("/body/validate/small", Json(Expected.Bytes("order.invalid.json")));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["CustomerId", "Status", "Lines"], Named(await Answer.Json(response)));
    }

    // rb:test body.rejected_first
    [Fact]
    [Trait("corpus", "body.rejected_first")]
    public async Task The_first_error_route_stops_at_the_first_property_that_fails()
    {
        using HttpResponseMessage response = await app.CreateClient().PostAsync("/body/validate/first-error", Json(Expected.Bytes("order.invalid.json")));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["CustomerId"], Named(await Answer.Json(response)));
    }

    [Theory]
    [InlineData("""{"customerId":0,"status":"","lines":[]}""")]
    [InlineData("""{"customerId":1,"status":"","lines":[]}""")]
    [InlineData("""{"customerId":1,"status":"open","lines":[]}""")]
    [InlineData("""{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0},{"productId":0,"qty":0}]}""")]
    public async Task The_first_error_route_answers_the_first_failure_full_validation_lists(string body)
    {
        HttpClient client = app.CreateClient();

        using HttpResponseMessage all = await client.PostAsync("/body/validate/small", Json(Encoding.UTF8.GetBytes(body)));
        using HttpResponseMessage first = await client.PostAsync("/body/validate/first-error", Json(Encoding.UTF8.GetBytes(body)));

        JsonObject expected = (await Answer.Json(all)).AsObject();
        JsonObject actual = (await Answer.Json(first)).AsObject();
        (string field, JsonNode? messages) = expected["errors"]!.AsObject().First();
        expected["errors"] = new JsonObject { [field] = new JsonArray(messages![0]!.DeepClone()) };
        expected.Remove("traceId");
        actual.Remove("traceId");
        Assert.Equal(all.StatusCode, first.StatusCode);
        Assert.True(JsonNode.DeepEquals(expected, actual), $"expected {expected.ToJsonString()}\n     got {actual.ToJsonString()}");
    }

    [Theory]
    [InlineData("""{"customerId":1,"status":"  ","lines":[{"productId":1,"qty":1}]}""", "Status")]
    [InlineData("""{"customerId":1,"status":"open","lines":null}""", "Lines")]
    [InlineData("""{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}""", "Lines[0].Qty")]
    public async Task A_body_that_breaks_one_rule_names_that_field_by_its_CLR_path(string body, string field)
    {
        using HttpResponseMessage response = await app.CreateClient().PostAsync("/body/validate/small", Json(Encoding.UTF8.GetBytes(body)));

        Assert.Equal([field], Named(await Answer.Json(response)));
    }

    [Fact]
    public async Task The_bind_routes_opt_out_of_validation()
    {
        using HttpResponseMessage response = await app.CreateClient().PostAsync("/body/bind/small", Json(Expected.Bytes("order.invalid.json")));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public void Only_the_validate_routes_keep_the_validation_filter_on_a_class_they_bind()
    {
        IServiceProviderIsService services = app.Services.GetRequiredService<IServiceProviderIsService>();

        string[] validated = [.. app.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(e => e.Metadata.GetMetadata<IDisableValidationMetadata>() is null)
            .Where(e => e.Metadata.GetMetadata<MethodInfo>()!.GetParameters()
                .Any(p => p.ParameterType.IsClass && p.ParameterType != typeof(string) && !services.IsService(p.ParameterType)))
            .Select(e => e.RoutePattern.RawText!)
            .Order()];

        Assert.Equal(["/body/validate/medium", "/body/validate/small"], validated);
    }

    [Theory]
    [InlineData("/body/validate/small")]
    [InlineData("/body/validate/first-error")]
    public async Task The_binder_refuses_a_value_of_the_wrong_type_before_validation_and_names_no_field(string path)
    {
        byte[] body = """{"customerId":"not-an-int","status":42,"lines":"nope"}"""u8.ToArray();

        using HttpResponseMessage response = await app.CreateClient().PostAsync(path, Json(body));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        JsonNode problem = await Answer.Json(response);
        Assert.Equal(400, (int?)problem["status"]);
        Assert.Null(problem["errors"]);
    }

    private static ByteArrayContent Json(byte[] body) => new(body) { Headers = { ContentType = new MediaTypeHeaderValue("application/json") } };

    private static string[] Named(JsonNode problem) => [.. problem["errors"]!.AsObject().Select(e => e.Key)];
}
