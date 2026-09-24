using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace Implementation.Routes;

/// <summary>
/// etag: ASP.NET Core computes no validator for a dynamic answer, so this is wired by hand as
/// an endpoint filter on these two routes. The filter serialises what the handler returned,
/// hashes it, and answers 304 when If-None-Match already names the hash. The body is built
/// and hashed before anything is compared, so a 304 saves the write and nothing else.
/// </summary>
public static class EtagRoutes
{
    public static void Map(IEndpointRouteBuilder app)
    {
        JsonSerializerOptions json = app.ServiceProvider.GetRequiredService<IOptions<JsonOptions>>().Value.SerializerOptions;

        app.MapGet("/etag/small", (HttpResponse response, Payloads p) => Fresh(response, p.Small))
           .AddEndpointFilter((context, next) => Revalidate(context, next, json))
           .DisableValidation();

        app.MapGet("/etag/large", (HttpResponse response, Payloads p) => Fresh(response, p.Large))
           .AddEndpointFilter((context, next) => Revalidate(context, next, json))
           .DisableValidation();
    }

    private static Payload Fresh(HttpResponse response, Payload payload)
    {
        Serial.Write(response);
        return payload;
    }

    // rb:wiring etag.*
    private static async ValueTask<object?> Revalidate(EndpointFilterInvocationContext context, EndpointFilterDelegate next, JsonSerializerOptions json)
    {
        object value = await next(context) ?? throw new InvalidOperationException("an etag route answered nothing");
        byte[] body = JsonSerializer.SerializeToUtf8Bytes(value, json.GetTypeInfo(value.GetType()));
        EntityTagHeaderValue tag = new($"\"{Convert.ToHexStringLower(SHA1.HashData(body))}\"");

        HttpContext http = context.HttpContext;
        http.Response.GetTypedHeaders().ETag = tag;
        bool known = http.Request.GetTypedHeaders().IfNoneMatch.Any(t => t.Compare(tag, useStrongComparison: false));
        return known ? Results.StatusCode(StatusCodes.Status304NotModified) : Results.Bytes(body, "application/json");
    }
}
