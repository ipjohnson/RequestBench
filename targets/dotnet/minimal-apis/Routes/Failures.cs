using System.Text.Json;
using RequestBench.Domain;

namespace RequestBench.MinimalApis.Routes;

/// <summary>
/// errors: every failure a handler raises, and the router's own miss.
///
/// The envelope is ProblemDetails, which is what ASP.NET answers with and what a client of
/// an ASP.NET API expects. The endpoint set pins the status and requires the body to say
/// which fields failed; it does not pin the shape, because an error envelope is a
/// framework's own contract and making twenty-eight of them share one hides a real
/// difference.
/// </summary>
public static class Failures
{
    /// <summary>The domain's field errors as ProblemDetails wants them: field to reasons.</summary>
    public static void Map(WebApplication app)
    {
        app.UseExceptionHandler(handler => handler.Run(async context =>
        {
            Exception? error = context.Features
                .Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
            IResult result = error switch
            {
                NotFoundException => Results.Problem(statusCode: 404),
                // A body the framework could not read, and a body the shared parse could not
                // read on the endpoints that take a free-form object. Nothing validated
                // either, so neither names a field, and 400 is the framework's own status
                // for an unreadable body.
                MalformedException or BadHttpRequestException or JsonException =>
                    Results.Problem(statusCode: 400),
                _ => Results.Problem(statusCode: 500, detail: error?.Message),
            };
            await result.ExecuteAsync(context);
        }));

        // rb:snippet errors.unmatched
        app.MapFallback(() => Results.Problem(statusCode: 404));
    }
}
