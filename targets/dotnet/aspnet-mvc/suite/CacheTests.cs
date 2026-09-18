
namespace RequestBench.AspNetMvc.Suite;

/// <summary>
/// cache: the framework's own response cache, and what it is keyed on.
///
/// The vary rows are the ones worth having. A store keyed on fewer headers than it declares
/// answers one tenant with another tenant's body, and that is a correctness failure a latency
/// chart renders as a target that got faster.
/// </summary>
public sealed class CacheTests(TargetApp app) : IClassFixture<TargetApp>
{
    // rb:test cache.small
    [Fact]
    public async Task The_small_cached_response_is_what_the_spec_pins()
    {
        Ask ask = Plan.For("cache.small");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test cache.medium
    [Fact]
    public async Task The_medium_one_is_too()
    {
        Ask ask = Plan.For("cache.medium");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test cache.large
    [Fact]
    public async Task And_the_large_one()
    {
        Ask ask = Plan.For("cache.large");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test cache.vary_one
    [Fact]
    public async Task A_response_varying_on_one_header_says_so()
    {
        Ask ask = Plan.For("cache.vary_one");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test cache.vary_many
    [Fact]
    public async Task And_one_varying_on_three_says_all_three()
    {
        Ask ask = Plan.For("cache.vary_many");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }
}
