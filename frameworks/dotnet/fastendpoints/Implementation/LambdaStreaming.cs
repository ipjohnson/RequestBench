using Microsoft.AspNetCore.Http.Features;

namespace Implementation;

/// <summary>
/// The sse and stream endpoints on lambda-emulator. Amazon.Lambda.AspNetCoreServer returns each
/// answer whole, so their events and rows would arrive as one body. On Lambda, where
/// AWS_LAMBDA_FUNCTION_NAME is set, an endpoint filter that the two endpoints add in Configure()
/// writes the answer through a Lambda response stream instead. Every other endpoint stays buffered.
/// </summary>
public static class LambdaStreaming
{
    private static readonly bool OnLambda = Environment.GetEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME") is not null;

    public static void StreamedOnLambda(this RouteHandlerBuilder route)
    {
        if (OnLambda)
        {
            route.AddEndpointFilter(StreamAsync);
        }
    }

    // The filter gets the endpoint back as a result, FastEndpoints' FeRequestHandler, and the
    // endpoint runs when that result executes. So the filter wraps the result.
    private static async ValueTask<object?> StreamAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next) =>
        await next(context) is IResult result ? new Streamed(result) : throw new InvalidOperationException("A streamed endpoint returns an IResult.");

    private sealed class Streamed(IResult inner) : IResult
    {
        public async Task ExecuteAsync(HttpContext context)
        {
            var body = new LambdaStreamBody(context.Response);
            context.Features.Set<IHttpResponseBodyFeature>(body);
            await inner.ExecuteAsync(context);
            await body.CompleteAsync();
        }
    }
}
