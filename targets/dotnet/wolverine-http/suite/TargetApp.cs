using Alba;
using Microsoft.AspNetCore.Http;
using RequestBench.Suite;

namespace RequestBench.WolverineTarget.Suite;

/// <summary>
/// The target, booted in process by Alba, which is what Wolverine's own documentation names
/// for HTTP tests.
///
/// Alba runs a scenario against the application's HttpContext, over TestServer like the four
/// beside it, rather than handing back an
/// HttpResponseMessage, so what a test reads is the response object the endpoint wrote to.
/// Wolverine compiles its endpoints at startup, which a test host pays for once here and
/// the measurement absorbs in warmup.
/// </summary>
public sealed class TargetApp : IAsyncLifetime
{
    public IAlbaHost Host { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        // Program.cs reads the fixture before the host is built, through the relative
        // fallback in DomainModel.FixturePath(). That fallback resolves against
        // targets/dotnet, which is not where a test host runs.
        Environment.SetEnvironmentVariable("RB_FIXTURE", Spec.FixturePath);
        Host = await AlbaHost.For<Program>();
    }

    public async Task DisposeAsync() => await Host.DisposeAsync();

    /// <summary>The four values the floor assertion compares, out of a scenario result.</summary>
    /// <remarks>
    /// The body is read off the response stream rather than through ReadAsText, because a
    /// gzipped response is not text and decoding it here would be the transport undoing what
    /// the test is checking. TestServer hands back a forward-only ResponseBodyReaderStream,
    /// so it is read once and never rewound.
    /// </remarks>
    public static (int Status, string ContentType, string Encoding, byte[] Raw) Answer(
        IScenarioResult result)
    {
        HttpResponse response = result.Context.Response;
        if (response.Body.CanSeek)
        {
            response.Body.Position = 0;
        }
        using MemoryStream copy = new();
        response.Body.CopyTo(copy);
        return ((int)response.StatusCode,
                response.ContentType ?? "",
                string.Join(", ", (string?[])response.Headers.ContentEncoding!),
                copy.ToArray());
    }
}
