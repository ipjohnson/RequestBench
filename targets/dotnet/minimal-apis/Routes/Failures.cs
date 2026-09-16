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
    public static Dictionary<string, string[]> ByField(IReadOnlyList<FieldError> errors) =>
        errors.GroupBy(e => e.Field)
              .ToDictionary(g => g.Key, g => g.Select(e => e.Rule).ToArray());

    public static void Map(WebApplication app)
    {
        app.UseExceptionHandler(handler => handler.Run(async context =>
        {
            Exception? error = context.Features
                .Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
            IResult result = error switch
            {
                NotFoundException => Results.Problem(statusCode: 404),
                ValidationException invalid =>
                    Results.ValidationProblem(ByField(invalid.Errors), statusCode: 422),
                // The framework raises this when it cannot read the request body, which is
                // what errors.malformed asks for. 400 is the RFC status for syntax it could
                // not parse, and the endpoint set accepts it alongside 422.
                BadHttpRequestException or JsonException => Results.Problem(statusCode: 400),
                _ => Results.Problem(statusCode: 500, detail: error?.Message),
            };
            await result.ExecuteAsync(context);
        }));

        // rb:snippet errors.unmatched
        app.MapFallback(() => Results.Problem(statusCode: 404));
    }
}
