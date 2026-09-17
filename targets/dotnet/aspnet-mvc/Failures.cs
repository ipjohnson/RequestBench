using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using RequestBench.Domain;

namespace RequestBench.AspNetMvc;

/// <summary>
/// errors: every failure an action raises.
///
/// The envelope is ProblemDetails, which is what MVC answers with and what a client of an
/// ASP.NET API expects. The endpoint set pins the status and requires the body to say which
/// fields failed; it does not pin the shape.
/// </summary>
// rb:wiring errors.*
public static class Failures
{
    /// <summary>The domain's field errors as ProblemDetails wants them: field to reasons.</summary>
    public static void Handler(IApplicationBuilder handler) => handler.Run(async context =>
    {
        Exception? error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        IResult result = error switch
        {
            NotFoundException => Results.Problem(statusCode: 404),
            // A body MVC could not read, and a body the shared parse could not read on the
            // endpoints that take a free-form object. Nothing validated either, so neither
            // names a field, and 400 is MVC's own status for an unreadable body.
            MalformedException or BadHttpRequestException or JsonException =>
                Results.Problem(statusCode: 400),
            _ => Results.Problem(statusCode: 500, detail: error?.Message),
        };
        await result.ExecuteAsync(context);
    });
}
