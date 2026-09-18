using System.Text;
using FastEndpoints.Testing;
using Xunit;

namespace RequestBench.FastEndpointsTarget.Suite;

/// <summary>
/// The target, booted in process by FastEndpoints' own AppFixture.
///
/// The only target here whose framework ships a test package, and taking it is not free:
/// FastEndpoints.Testing 8.3.0 is built on xunit.v3, so this suite runs a different xunit
/// major than the four beside it, which `dotnet new xunit` writes at 2.9.3. Underneath it is
/// still WebApplicationFactory, which AppFixture wraps and caches across test classes.
/// </summary>
// rb:test *
public sealed class TargetApp : AppFixture<Program>
{
    protected override ValueTask PreSetupAsync()
    {
        // Before the WAF boots, because Program.cs reads the fixture while the builder is
        // still being configured. SetupAsync would be too late.
        Environment.SetEnvironmentVariable("RB_FIXTURE", Spec.FixturePath);
        return ValueTask.CompletedTask;
    }

    /// <summary>Send one of an endpoint's planned requests.</summary>
    /// <remarks>
    /// The method, path, headers and body all come from spec/plan.json. AppFixture's Client is
    /// an HttpClient like the three WebApplicationFactory targets use, so what FastEndpoints'
    /// own package changes is the fixture around it and the xunit under it, not this.
    ///
    /// The cancellation token is threaded because xunit.v3's analyzer refuses a call that takes
    /// one and is not given the ambient one, and this repository builds warnings as errors. The
    /// four suites on xunit 2.9.3 are not asked for it.
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
        return await Client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Ask for the validator first, then send the request that carries it.</summary>
    public async Task<HttpResponseMessage> SendAfterCapture(Ask ask)
    {
        (string method, string path, string header) = Plan.CaptureFor(ask)
            ?? throw new InvalidOperationException($"{ask.Id} captures nothing");
        using HttpResponseMessage first = await Client.SendAsync(
            new HttpRequestMessage(new HttpMethod(method), path),
            TestContext.Current.CancellationToken);
        string captured = first.Headers.TryGetValues(header, out IEnumerable<string>? values)
            ? values.First() : "";
        return await Send(ask, Plan.Resolved(ask, captured));
    }
}
// rb:end
