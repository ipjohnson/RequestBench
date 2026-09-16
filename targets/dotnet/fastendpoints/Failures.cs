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
            case ValidationException invalid:
                await context.Response.SendErrorsAsync(
                    [.. invalid.Errors.Select(e =>
                        new FluentValidation.Results.ValidationFailure(e.Field, e.Rule))],
                    statusCode: 422);
                break;
            // 400 is the RFC status for syntax the framework could not parse, and the
            // endpoint set accepts it alongside 422.
            case BadHttpRequestException or JsonException:
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
