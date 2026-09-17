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
}
