using Alba;
using RequestBench.Suite;

namespace RequestBench.WolverineTarget.Suite;

/// <summary>
/// middleware, against the Before methods in Routes/Middleware.cs.
///
/// The layers are no-ops, so nothing they do is visible in a response and no assertion over
/// one can tell four apart from sixteen. What a test can hold is the thing that goes wrong
/// in practice: a test that calls the endpoint method rather than the app passes while the
/// layers never ran, and Wolverine makes that unusually easy, because the endpoints are
/// plain static methods and the middleware is woven in by the code it generates. Going
/// through a scenario is what puts the generated wrapper back in the path.
/// </summary>
public sealed class MiddlewareTests(TargetApp app) : IClassFixture<TargetApp>
{
    private async Task<IScenarioResult> Send(string path) =>
        await app.Host.Scenario(scenario =>
        {
            scenario.Get.Url(path);
            // The status spec/expected.json pins is the authority; see CompressedTests.
            scenario.IgnoreStatusCode();
        });

    // rb:test middleware.none
    [Fact]
    public async Task The_unlayered_route_answers_the_shared_payload()
    {
        (int status, string type, string encoding, byte[] raw) =
            TargetApp.Answer(await Send("/middleware/none"));

        Floor.Assert(Spec.For("middleware.none"), status, type, encoding, raw);
    }

    // rb:test middleware.four
    [Fact]
    public async Task Four_layers_do_not_change_the_answer()
    {
        (int status, string type, string encoding, byte[] raw) =
            TargetApp.Answer(await Send("/middleware/four"));

        Floor.Assert(Spec.For("middleware.four"), status, type, encoding, raw);
    }

    // rb:test middleware.sixteen
    [Fact]
    public async Task Sixteen_layers_do_not_change_it_either()
    {
        (int status, string type, string encoding, byte[] raw) =
            TargetApp.Answer(await Send("/middleware/sixteen"));

        Floor.Assert(Spec.For("middleware.sixteen"), status, type, encoding, raw);
    }
}
