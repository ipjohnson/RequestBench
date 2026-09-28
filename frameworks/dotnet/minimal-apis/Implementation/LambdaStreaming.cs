using Microsoft.AspNetCore.Http.Features;

namespace Implementation;

/// <summary>
/// The sse and stream routes on lambda-emulator. Amazon.Lambda.AspNetCoreServer returns each answer
/// whole, so their events and rows would arrive as one body. On Lambda, where
/// AWS_LAMBDA_FUNCTION_NAME is set, an endpoint filter on those two routes writes the answer through
/// a Lambda response stream instead. Every other route stays buffered.
/// </summary>
public static class LambdaStreaming
{
    private static readonly bool OnLambda = Environment.GetEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME") is not null;

    public static RouteHandlerBuilder StreamedOnLambda(this RouteHandlerBuilder route) =>
        OnLambda ? route.AddEndpointFilter(Stream) : route;

    // An endpoint filter returns before the result is written, so it wraps the result.
    private static async ValueTask<object?> Stream(EndpointFilterInvocationContext context, EndpointFilterDelegate next) =>
        await next(context) is IResult result ? new Streamed(result) : throw new InvalidOperationException("A streamed route returns an IResult.");

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
