using Alba;
using Microsoft.AspNetCore.Http;

namespace RequestBench.WolverineTarget.Suite;

/// <summary>
/// headers: reading request headers, at a few and at many.
///
/// The header count is the variable and the body is fixed, so a target that stopped reading
/// headers at some limit would answer this correctly and still be wrong. What a response can
/// hold is that the request was accepted with all of them attached, which is what these do.
/// </summary>
public sealed class HeadersTests(TargetApp app) : IClassFixture<TargetApp>
{
    // rb:test headers.few
    [Fact]
    public async Task A_request_carrying_a_few_headers_is_served()
    {
        Ask ask = Plan.For("headers.few");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
    }

    // rb:test headers.many
    [Fact]
    public async Task And_one_carrying_many_is_served_the_same_way()
    {
        Ask ask = Plan.For("headers.many");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
    }
}
