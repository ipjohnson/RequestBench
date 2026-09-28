using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Implementation;

/// <summary>
/// A resource filter on the sse and stream actions for lambda-emulator.
/// Amazon.Lambda.AspNetCoreServer returns each answer whole, so their events and rows would arrive
/// as one body. On Lambda, where AWS_LAMBDA_FUNCTION_NAME is set, the filter writes the answer
/// through a Lambda response stream instead. The stream action writes its rows itself, and the sse
/// action's result writes its events, so the filter has to run around the action and its result,
/// which is what a resource filter does. On the other hosts it does nothing. Every other action
/// stays buffered.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class LambdaStreamedAttribute : Attribute, IAsyncResourceFilter
{
    private static readonly bool OnLambda = Environment.GetEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME") is not null;

    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        if (!OnLambda)
        {
            await next();
            return;
        }
        var body = new LambdaStreamBody(context.HttpContext.Response);
        context.HttpContext.Features.Set<IHttpResponseBodyFeature>(body);
        await next();
        await body.CompleteAsync();
    }
}
