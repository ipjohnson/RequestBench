using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace Implementation.Controllers;

/// <summary>
/// etag: ASP.NET Core computes no validator for a dynamic answer, so this is wired by hand as
/// a result filter on these two actions. The body is built and hashed before anything is
/// compared, so a 304 saves the write and nothing else.
/// </summary>
[ApiController]
public sealed class EtagController(Payloads payloads) : ControllerBase
{
    [HttpGet("/etag/small")]
    [Revalidate]
    public Payload Small() => Fresh(payloads.Small);

    [HttpGet("/etag/large")]
    [Revalidate]
    public Payload Large() => Fresh(payloads.Large);

    private Payload Fresh(Payload payload)
    {
        Serial.Write(Response);
        return payload;
    }
}

// rb:wiring etag.*
/// <summary>
/// Serialises what the action returned with MVC's JSON options and hashes it with SHA-1. The
/// bytes and the tag go to MVC's FileContentResult, which sets ETag and answers 304 when
/// If-None-Match names the tag.
/// </summary>
public sealed class RevalidateAttribute : ResultFilterAttribute
{
    public override void OnResultExecuting(ResultExecutingContext context)
    {
        if (context.Result is not ObjectResult { Value: { } value })
        {
            return;
        }
        JsonSerializerOptions json = context.HttpContext.RequestServices.GetRequiredService<IOptions<JsonOptions>>().Value.JsonSerializerOptions;
        byte[] body = JsonSerializer.SerializeToUtf8Bytes(value, value.GetType(), json);
        context.Result = new FileContentResult(body, "application/json")
        {
            EntityTag = new EntityTagHeaderValue($"\"{Convert.ToHexStringLower(SHA1.HashData(body))}\""),
        };
    }
}
