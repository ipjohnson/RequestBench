using System.Collections;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.Extensions.Options;

namespace Implementation.Controllers;

/// <summary>
/// body: the order bound from JSON by MVC and validated by MVC. [ApiController] runs the
/// DataAnnotations on the order before the action is entered, and answers a failure with its
/// own 400. The bind actions bind UnvalidatedOrder, so they parse and bind and check nothing.
/// A body the input formatter cannot read never reaches validation, and is answered with the
/// same automatic 400.
/// </summary>
[ApiController]
public sealed class BodyController : ControllerBase
{
    [HttpPost("/body/bind/small")]
    public Bound BindSmall(UnvalidatedOrder order) => Bound.Of(order, Request);

    [HttpPost("/body/bind/medium")]
    public Bound BindMedium(UnvalidatedOrder order) => Bound.Of(order, Request);

    [HttpPost("/body/validate/small")]
    public Bound ValidateSmall(OrderRequest order) => Bound.Of(order, Request);

    [HttpPost("/body/validate/medium")]
    public Bound ValidateMedium(OrderRequest order) => Bound.Of(order, Request);

    [HttpPost("/body/validate/first-error")]
    [FirstError]
    public Bound ValidateFirstError(UnvalidatedOrder order) => Bound.Of(order, Request);
}

// rb:wiring body.*
/// <summary>
/// The first-error route's validation, by hand. DataAnnotations has no mode that stops at the
/// first failure, and MVC's MaxModelValidationErrors holds for every action and names the
/// overflow with an empty key. So the route binds an order MVC does not validate, and this
/// filter walks MVC's metadata for it instead: one property at a time in declaration order, and
/// after the list's own rules each line's properties in index order, running the DataAnnotations
/// MVC holds for each. The first failure goes into ModelState under the key MVC's validation
/// gives it, and [ApiController]'s InvalidModelStateResponseFactory writes the refusal.
/// </summary>
public sealed class FirstErrorAttribute : Attribute, IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        IServiceProvider services = context.HttpContext.RequestServices;
        IModelMetadataProvider metadata = services.GetRequiredService<IModelMetadataProvider>();
        foreach (object? argument in context.ActionArguments.Values)
        {
            if (argument is not null && !Valid(metadata.GetMetadataForType(argument.GetType()), argument, "", context.ModelState))
            {
                context.Result = services.GetRequiredService<IOptions<ApiBehaviorOptions>>().Value.InvalidModelStateResponseFactory(context);
                return;
            }
        }
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
    }

    /// <summary>False, with the failure in ModelState, at the first property whose rules fail.</summary>
    private static bool Valid(ModelMetadata type, object model, string prefix, ModelStateDictionary state)
    {
        foreach (ModelMetadata property in type.Properties)
        {
            object? value = property.PropertyGetter!(model);
            string key = ModelNames.CreatePropertyModelName(prefix, property.PropertyName);
            ValidationContext rules = new(model) { MemberName = property.PropertyName, DisplayName = property.GetDisplayName() };
            foreach (ValidationAttribute rule in property.ValidatorMetadata.OfType<ValidationAttribute>())
            {
                if (rule.GetValidationResult(value, rules) is { ErrorMessage: string message })
                {
                    state.AddModelError(key, message);
                    return false;
                }
            }
            if (property.ElementMetadata is { IsComplexType: true } element && value is IEnumerable rows)
            {
                int index = 0;
                foreach (object? row in rows)
                {
                    if (row is not null && !Valid(element, row, ModelNames.CreateIndexModelName(key, index), state))
                    {
                        return false;
                    }
                    index++;
                }
            }
        }
        return true;
    }
}
// rb:end
