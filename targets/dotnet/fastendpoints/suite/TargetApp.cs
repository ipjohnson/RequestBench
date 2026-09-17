using FastEndpoints.Testing;
using RequestBench.Suite;

namespace RequestBench.FastEndpointsTarget.Suite;

/// <summary>
/// The target, booted in process by FastEndpoints' own AppFixture.
///
/// The only target here whose framework ships a test package, and taking it is not free:
/// FastEndpoints.Testing 8.3.0 is built on xunit.v3, so this suite runs a different xunit
/// major than the four beside it, which `dotnet new xunit` writes at 2.9.3. Underneath it is
/// still WebApplicationFactory, which AppFixture wraps and caches across test classes.
/// </summary>
public sealed class TargetApp : AppFixture<Program>
{
    protected override ValueTask PreSetupAsync()
    {
        // Before the WAF boots, because Program.cs reads the fixture while the builder is
        // still being configured. SetupAsync would be too late.
        Environment.SetEnvironmentVariable("RB_FIXTURE", Spec.FixturePath);
        return ValueTask.CompletedTask;
    }
}
