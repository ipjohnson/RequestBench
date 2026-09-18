
namespace RequestBench.MinimalApis.Suite;

/// <summary>
/// headers: reading request headers, at five and at thirty, left unread and with three bound.
///
/// /headers answers a fixed body, so what its two tests hold is that the request was accepted
/// with all of them attached. /headers/bind answers with the three it bound, and Plan fills
/// the pinned body with the values it drew for this run, so the floor check there is an echo
/// check. A target that dropped a header, or answered the account as a string, fails it.
/// </summary>
public sealed class HeadersTests(TargetApp app) : IClassFixture<TargetApp>
{
    // rb:test headers.few
    [Fact]
    public async Task A_request_carrying_a_few_headers_is_served()
    {
        Ask ask = Plan.For("headers.few");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test headers.many
    [Fact]
    public async Task And_one_carrying_many_is_served_the_same_way()
    {
        Ask ask = Plan.For("headers.many");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test headers.bind_few
    [Fact]
    public async Task Three_bound_headers_come_back_in_the_echo()
    {
        Ask ask = Plan.For("headers.bind_few");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test headers.bind_many
    [Fact]
    public async Task And_the_same_three_come_back_from_among_thirty()
    {
        Ask ask = Plan.For("headers.bind_many");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }
}
