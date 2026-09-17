using Microsoft.AspNetCore.Mvc.Testing;
using RequestBench.Suite;

namespace RequestBench.AspNetMvc.Suite;

/// <summary>
/// The target, booted in process by WebApplicationFactory.
///
/// The same test host minimal-apis uses, for a framework that shares nothing else with it.
/// Microsoft.AspNetCore.Mvc.Testing is named for MVC and is what both reach for, and the
/// alternative its own documentation offers for a controller, MockMvc's equivalent of
/// calling the action directly, would never run the filter the compressed family is wired
/// with. What is being tested here is the application, not the controller.
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
