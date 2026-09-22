using System.Security.Cryptography;
using System.Text.Json;
using JasperFx.CodeGeneration.Frames;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;
using Wolverine.Http;
using Wolverine.Http.Resources;

namespace Implementation.Endpoints;

/// <summary>
/// etag: Wolverine computes no validator, and ASP.NET Core computes none for a dynamic answer, so
/// the validator is computed by hand. Wolverine writes an endpoint's answer from inside the handler
/// it generated, and a resource writer policy is how an application tells it to write an answer
/// some other way. ETagWriterPolicy does that for the two [Tagged] routes.
/// </summary>
public static class EtagEndpoints
{
    [WolverineGet("/etag/small")]
    [Tagged]
    public static Payload Small(HttpResponse response, Payloads p) => Fresh(response, p.Small);

    [WolverineGet("/etag/large")]
    [Tagged]
    public static Payload Large(HttpResponse response, Payloads p) => Fresh(response, p.Large);

    private static Payload Fresh(HttpResponse response, Payload payload)
    {
        Serial.Write(response);
        return payload;
    }
}

// rb:wiring etag.*
/// <summary>An endpoint whose answer ETagWriterPolicy writes.</summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class TaggedAttribute : Attribute;

/// <summary>
/// On a [Tagged] endpoint, the generated handler passes the answer to ETags.WriteAsync where it
/// would have written it as JSON.
/// </summary>
public sealed class ETagWriterPolicy : IResourceWriterPolicy
{
    public bool TryApply(HttpChain chain)
    {
        if (!chain.Method.Method.IsDefined(typeof(TaggedAttribute), inherit: false))
        {
            return false;
        }
        chain.Postprocessors.Add(new MethodCall(typeof(ETags), nameof(ETags.WriteAsync)));
        return true;
    }
}

public static class ETags
{
    /// <summary>
    /// Serialises the answer with the JSON options Wolverine writes with, and hashes it with SHA-1.
    /// ASP.NET Core's byte-array result sets the tag and answers 304 when If-None-Match already
    /// names it. The body is built and hashed before anything is compared, so a 304 saves the
    /// write and nothing else.
    /// </summary>
    public static Task WriteAsync(HttpContext context, Payload payload, IOptions<JsonOptions> json)
    {
        byte[] body = JsonSerializer.SerializeToUtf8Bytes(payload, json.Value.SerializerOptions.GetTypeInfo(typeof(Payload)));
        EntityTagHeaderValue tag = new($"\"{Convert.ToHexStringLower(SHA1.HashData(body))}\"");
        return Results.Bytes(body, "application/json", entityTag: tag).ExecuteAsync(context);
    }
}
// rb:end
