using Microsoft.AspNetCore.Mvc.Testing;
using RequestBench.Suite;

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
}
