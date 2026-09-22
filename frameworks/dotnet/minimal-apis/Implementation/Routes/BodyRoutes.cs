// Microsoft.Extensions.Validation marks the types it builds validation from as experimental in
// .NET 10, and the first-error route builds on them.
#pragma warning disable ASP0029

using System.ComponentModel.DataAnnotations;
using System.Reflection;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Validation;

namespace Implementation.Routes;

/// <summary>
/// body: the order bound by minimal APIs on every route, and checked against its rules on the
/// validate routes by minimal APIs' own validation. AddValidation puts an endpoint filter on
/// every route that binds a class, which checks the class's DataAnnotations before the handler
/// runs and answers 400 with every failure. The bind routes opt out. A body the binder cannot
/// read never reaches the filter, and is answered with the binder's own 400.
/// </summary>
public static class BodyRoutes
{
    public static void Map(IEndpointRouteBuilder app)
    {
        ValidationOptions validation = app.ServiceProvider.GetRequiredService<IOptions<ValidationOptions>>().Value;

        app.MapPost("/body/bind/small", (OrderRequest order, HttpRequest request) => Bound.Of(order, request)).DisableValidation();

        app.MapPost("/body/bind/medium", (OrderRequest order, HttpRequest request) => Bound.Of(order, request)).DisableValidation();

        app.MapPost("/body/validate/small", (OrderRequest order, HttpRequest request) => Bound.Of(order, request));

        app.MapPost("/body/validate/medium", (OrderRequest order, HttpRequest request) => Bound.Of(order, request));

        app.MapPost("/body/validate/first-error", (OrderRequest order, HttpRequest request) => Bound.Of(order, request))
           .DisableValidation()
           .AddEndpointFilter((context, next) => StopAtFirst(context, next, validation));
    }

    // rb:wiring body.*
    /// <summary>OrderRequest's properties in the order they are declared.</summary>
    private static readonly ValidatablePropertyInfo[] Declared =
        [.. typeof(OrderRequest).GetProperties().OrderBy(p => p.MetadataToken).Select(p => new DeclaredProperty(p))];

    /// <summary>
    /// Minimal APIs' validation checks every property and has no setting to stop at the first
    /// failure, so the first-error route opts out of it and this filter checks one property at a
    /// time. Each check is Microsoft.Extensions.Validation's own, which names the field and
    /// checks each line as AddValidation's filter does. The first failure is answered with the
    /// result minimal APIs answer a failed validation with.
    /// </summary>
    private static async ValueTask<object?> StopAtFirst(EndpointFilterInvocationContext context, EndpointFilterDelegate next, ValidationOptions validation)
    {
        OrderRequest order = context.GetArgument<OrderRequest>(0);
        HttpContext http = context.HttpContext;
        ValidateContext check = new()
        {
            ValidationContext = new ValidationContext(order, http.RequestServices, items: null),
            ValidationOptions = validation,
        };
        ValidationErrorContext? first = null;
        check.OnValidationError += error => first ??= error;
        foreach (ValidatablePropertyInfo property in Declared)
        {
            await property.ValidateAsync(order, check, http.RequestAborted);
            if (first is ValidationErrorContext failed)
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]> { [failed.Path] = [failed.Errors[0]] });
            }
        }
        return await next(context);
    }

    /// <summary>A property and its DataAnnotations, as the code the validation generator writes describes one.</summary>
    private sealed class DeclaredProperty(PropertyInfo property)
        : ValidatablePropertyInfo(property.DeclaringType!, property.PropertyType, property.Name, property.Name)
    {
        private readonly ValidationAttribute[] attributes = [.. property.GetCustomAttributes<ValidationAttribute>()];

        protected override ValidationAttribute[] GetValidationAttributes() => attributes;
    }
    // rb:end
}
