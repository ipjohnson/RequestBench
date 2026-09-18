using FastEndpoints.Testing;
using Xunit;

namespace RequestBench.FastEndpointsTarget.Suite;

/// <summary>
/// query: parsing, percent-decoding and coercing query parameters, at one and at eight.
///
/// The answer is the small payload with an echo of every value the target bound. Plan draws
/// the values once per process, puts them in the path percent-encoded and fills them into the
/// pinned answer, so the floor holds each of them as well as the status. A target that drops
/// a parameter, coerces one wrong or leaves the %20 in q undecoded answers a different echo.
/// </summary>
public sealed class QueryTests(TargetApp app) : TestBase<TargetApp>
{
    // rb:test query.one
    [Fact]
    public async Task One_query_parameter_is_read()
    {
        Ask ask = Plan.For("query.one");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test query.many
    [Fact]
    public async Task Eight_of_them_are_read_and_coerced()
    {
        Ask ask = Plan.For("query.many");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }
}
