using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using RequestBench.Domain;

namespace RequestBench.CarterTarget;

/// <summary>
/// errors: every failure a handler raises, and the router's own miss.
///
/// The envelope is ProblemDetails. Carter routes onto minimal APIs, so that is what a
/// client of this stack expects; the endpoint set pins the status and requires the body to
/// say which fields failed, not the shape.
/// </summary>
public static class Failures
{
    public static Dictionary<string, string[]> ByField(IReadOnlyList<FieldError> errors) =>
        errors.GroupBy(e => e.Field)
              .ToDictionary(g => g.Key, g => g.Select(e => e.Rule).ToArray());

    public static void Handler(IApplicationBuilder handler) => handler.Run(async context =>
    {
        Exception? error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        IResult result = error switch
        {
            NotFoundException => Results.Problem(statusCode: 404),
            ValidationException invalid =>
                Results.ValidationProblem(ByField(invalid.Errors), statusCode: 422),
            BadHttpRequestException or JsonException => Results.Problem(statusCode: 400),
            _ => Results.Problem(statusCode: 500, detail: error?.Message),
        };
        await result.ExecuteAsync(context);
    });
}
