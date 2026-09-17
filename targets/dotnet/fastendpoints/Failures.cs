using System.Text.Json;
using FastEndpoints;
using Microsoft.AspNetCore.Diagnostics;
using RequestBench.Domain;

namespace RequestBench.FastEndpointsTarget;

/// <summary>
/// errors: every failure a handler raises.
///
/// A validation failure is handed back to FastEndpoints as its own ValidationFailure list,
/// so the response is the shape FastEndpoints produces rather than one this repository
/// invented. The endpoint set pins the status and requires the body to say which fields
/// failed; it does not pin the shape.
/// </summary>
public static class Failures
{
    // rb:wiring errors.*
    public static void Handler(IApplicationBuilder handler) => handler.Run(async context =>
    {
        Exception? error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        switch (error)
        {
            // SendNotFoundAsync sends a bare status with no body, which says nothing about
            // what failed; the endpoint set requires an error response to say.
            case NotFoundException:
                context.Response.StatusCode = 404;
                await context.Response.WriteAsJsonAsync(
                    new { statusCode = 404, message = "not found" });
                break;
            // A failed Validator never reaches here: FastEndpoints answers it itself, with
            // its own ErrorResponse, before the handler is entered. What is left is a body
            // nothing could read, which names no field.
            case MalformedException or BadHttpRequestException or JsonException:
                context.Response.StatusCode = 400;
                await context.Response.WriteAsJsonAsync(
                    new { statusCode = 400, message = "the request body is not json" });
                break;
            default:
                context.Response.StatusCode = 500;
                await context.Response.WriteAsJsonAsync(
                    new { statusCode = 500, message = error?.Message ?? "internal" });
                break;
        }
    });
}
