using System.Text;
using Microsoft.AspNetCore.Mvc.Testing;
using RequestBench.Suite;

namespace RequestBench.CarterTarget.Suite;

/// <summary>
/// The target, booted in process by WebApplicationFactory.
///
/// Carter ships no test package of its own, so this is ASP.NET Core's, reached for directly.
/// That is not a gap: Carter routes onto minimal APIs, so the application a test boots is a
/// WebApplication either way and the module is in the pipeline like any other registration.
/// The cost of testing this target is the cost of testing the thing underneath it.
/// </summary>
public sealed class TargetApp : WebApplicationFactory<Program>
{
    public TargetApp()
    {
        // Program.cs reads the fixture before the host is built, through the relative
        // fallback in DomainModel.FixturePath(). That fallback resolves against
        // targets/dotnet, which is not where a test host runs.
        Environment.SetEnvironmentVariable("RB_FIXTURE", Spec.FixturePath);
    }

    /// <summary>A client that hands back what the target sent, compressed or not.</summary>
    public HttpClient Raw() => CreateClient();

    /// <summary>Send one of an endpoint's planned requests.</summary>
    /// <remarks>
    /// The method, path, headers and body all come from spec/plan.json. What is authored here
    /// is how this framework's test host is asked, which is the part that differs between
    /// targets; the values in the request are not a suite's to choose.
    /// </remarks>
    public Task<HttpResponseMessage> Send(Ask ask) => Send(ask, ask.Headers);

    private async Task<HttpResponseMessage> Send(Ask ask, IDictionary<string, string> headers)
    {
        HttpRequestMessage request = new(new HttpMethod(ask.Method), ask.Path);
        foreach ((string name, string value) in headers)
        {
            // content-type belongs to the content, and HttpClient refuses it on the request.
            if (!name.Equals("content-type", StringComparison.OrdinalIgnoreCase))
            {
                request.Headers.TryAddWithoutValidation(name, value);
            }
        }
        if (ask.Body is string body)
        {
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        }
        return await Raw().SendAsync(request);
    }

    /// <summary>Ask for the validator first, then send the request that carries it.</summary>
    /// <remarks>
    /// etag.match_large is the only endpoint shaped this way. Its if-none-match is a validator
    /// only the target can produce, so nothing can send the request until the target has
    /// answered a different one.
    /// </remarks>
    public async Task<HttpResponseMessage> SendAfterCapture(Ask ask)
    {
        (string method, string path, string header) = Plan.CaptureFor(ask)
            ?? throw new InvalidOperationException($"{ask.Id} captures nothing");
        using HttpResponseMessage first =
            await Raw().SendAsync(new HttpRequestMessage(new HttpMethod(method), path));
        string captured = first.Headers.TryGetValues(header, out IEnumerable<string>? values)
            ? values.First() : "";
        return await Send(ask, Plan.Resolved(ask, captured));
    }
}
