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
public static class Failures
{
    /// <summary>The domain's field errors as ProblemDetails wants them: field to reasons.</summary>
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
