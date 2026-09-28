using Microsoft.AspNetCore.Http.Features;

namespace Implementation;

/// <summary>
/// Wolverine middleware on the sse and stream endpoints for lambda-emulator.
/// Amazon.Lambda.AspNetCoreServer returns each answer whole, so their events and rows would arrive
/// as one body. On Lambda, where AWS_LAMBDA_FUNCTION_NAME is set, Before puts a Lambda response
/// stream in place of the response body, and Finally ends the stream once the answer is written.
/// On the other hosts neither does anything. Every other endpoint stays buffered.
/// </summary>
public static class LambdaStreaming
{
    private static readonly bool OnLambda = Environment.GetEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME") is not null;

    public static LambdaStreamBody? Before(HttpContext context)
    {
        if (!OnLambda)
        {
            return null;
        }
        var body = new LambdaStreamBody(context.Response);
        context.Features.Set<IHttpResponseBodyFeature>(body);
        return body;
    }

    public static Task FinallyAsync(LambdaStreamBody? body) => body?.CompleteAsync() ?? Task.CompletedTask;
}
