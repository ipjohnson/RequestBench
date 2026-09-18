using System.Text;
using Microsoft.AspNetCore.Mvc.Testing;

namespace RequestBench.MinimalApis.Suite;

/// <summary>
/// The target, booted in process by WebApplicationFactory.
///
/// No Kestrel and no socket: the client talks to the pipeline through TestServer. UseUrls is
/// ignored, and the line Program.cs prints about listening on a port is its own log
/// statement rather than something binding. Every
/// filter still runs, because minimal APIs' endpoint filters are part of the pipeline rather
/// than something the server does underneath it, which is the reason the compressed family
/// can be tested this way here and cannot be everywhere.
/// </summary>
// rb:test *
public sealed class TargetApp : WebApplicationFactory<Program>
{
    public TargetApp()
    {
        // Program.cs reads the fixture before the host is built, through the relative
        // fallback in DomainModel.FixturePath(). That fallback resolves against
        // targets/dotnet, which is where harness/run.py starts a target and is not where a
        // test host runs, so the suite passes the same absolute path run.py passes.
        Environment.SetEnvironmentVariable("RB_FIXTURE", Spec.FixturePath);
    }

    /// <summary>A client that hands back what the target sent, compressed or not.</summary>
    /// <remarks>
    /// HttpClient decompresses nothing unless asked, which is what this family needs: a
    /// handler with AutomaticDecompression set would strip content-encoding on the way
    /// through and every gzip assertion would pass against an identity response.
    /// </remarks>
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
// rb:end
