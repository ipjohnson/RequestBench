using System.Security.Cryptography;
using System.Text.Json;
using FastEndpoints;
using FluentValidation.Results;
using Microsoft.Net.Http.Headers;

namespace Implementation.Endpoints;

/// <summary>
/// etag: ASP.NET Core computes no validator for a dynamic answer, and FastEndpoints adds none,
/// so this is wired by hand as FastEndpoints' response interceptor on these two endpoints. The
/// handler sends its answer through Send.InterceptedAsync, which hands it to the interceptor
/// before anything is written. The body is built and hashed before anything is compared, so a
/// 304 saves the write and nothing else.
/// </summary>
// rb:handler etag.small
public sealed class EtagSmallEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure()
    {
        Get("/etag/small");
        ResponseInterceptor(Revalidate.Instance);
    }

    public override Task HandleAsync(CancellationToken ct)
    {
        Serial.Write(HttpContext.Response);
        return Send.InterceptedAsync(payloads.Small, cancellation: ct);
    }
}

// rb:handler etag.large,etag.match_large,etag.stale_large
public sealed class EtagLargeEndpoint(Payloads payloads) : EndpointWithoutRequest<Payload>
{
    public override void Configure()
    {
        Get("/etag/large");
        ResponseInterceptor(Revalidate.Instance);
    }

    public override Task HandleAsync(CancellationToken ct)
    {
        Serial.Write(HttpContext.Response);
        return Send.InterceptedAsync(payloads.Large, cancellation: ct);
    }
}

// rb:wiring etag.*
/// <summary>
/// Serialises the answer with FastEndpoints' serializer options, hashes it with SHA-1, and
/// answers 304 when If-None-Match names the hash. Otherwise it writes the bytes it hashed, and
/// Send.InterceptedAsync sends nothing more.
/// </summary>
public sealed class Revalidate : IResponseInterceptor
{
    public static readonly Revalidate Instance = new();

    public Task InterceptResponseAsync(object response, int statusCode, HttpContext ctx, IReadOnlyCollection<ValidationFailure> failures, CancellationToken ct)
    {
        JsonSerializerOptions json = ctx.RequestServices.GetRequiredService<Config>().Serializer.Options;
        byte[] body = JsonSerializer.SerializeToUtf8Bytes(response, response.GetType(), json);
        EntityTagHeaderValue tag = new($"\"{Convert.ToHexStringLower(SHA1.HashData(body))}\"");

        ctx.Response.GetTypedHeaders().ETag = tag;
        bool known = ctx.Request.GetTypedHeaders().IfNoneMatch.Any(t => t.Compare(tag, useStrongComparison: false));
        return known
            ? ctx.Response.SendNotModifiedAsync(ct)
            : ctx.Response.SendBytesAsync(body, contentType: "application/json; charset=utf-8", cancellation: ct);
    }
}
// rb:end
