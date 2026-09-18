using Alba;
using Microsoft.AspNetCore.Http;

namespace RequestBench.WolverineTarget.Suite;

/// <summary>
/// query: parsing and coercing query parameters, at one and at eight.
///
/// The values never reach the answer, which is the point: this family is the parse and the
/// coercion isolated from any use of them. A target that silently drops a parameter it cannot
/// coerce answers the same body as one that read all eight, so what these hold is the status.
/// </summary>
public sealed class QueryTests(TargetApp app) : IClassFixture<TargetApp>
{
    // rb:test query.one
    [Fact]
    public async Task One_query_parameter_is_read()
    {
        Ask ask = Plan.For("query.one");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
    }

    // rb:test query.many
    [Fact]
    public async Task Eight_of_them_are_read_and_coerced()
    {
        Ask ask = Plan.For("query.many");

        IScenarioResult result = await app.Send(ask);

        (int status, string type, string encoding, byte[] raw) = TargetApp.Answer(result);
        Floor.Assert(ask, status, type, encoding, raw);
    }
}
