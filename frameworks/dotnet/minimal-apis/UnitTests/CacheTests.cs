namespace UnitTests;

public sealed class CacheTests(MinimalApisApp app) : IClassFixture<MinimalApisApp>
{
    // rb:test cache.small,cache.medium,cache.large
    [Theory]
    [Trait("corpus", "cache.small")]
    [Trait("corpus", "cache.medium")]
    [Trait("corpus", "cache.large")]
    [InlineData("small")]
    [InlineData("medium")]
    [InlineData("large")]
    public async Task A_second_request_is_the_stored_answer(string size)
    {
        HttpClient client = app.CreateClient();

        using HttpResponseMessage first = await client.GetAsync($"/cache/{size}");
        using HttpResponseMessage second = await client.GetAsync($"/cache/{size}");

        await Answer.Is(Expected.Json($"items.{size}.json"), second);
        Assert.Equal(Answer.Serial(first), Answer.Serial(second));
    }

    // rb:test cache.vary_one
    [Fact]
    [Trait("corpus", "cache.vary_one")]
    public async Task One_vary_header_keys_the_store()
    {
        long alpha = await Serial("/cache/vary/one", ("x-rb-tenant", "alpha"));
        long beta = await Serial("/cache/vary/one", ("x-rb-tenant", "beta"));

        Assert.Equal(alpha, await Serial("/cache/vary/one", ("x-rb-tenant", "alpha")));
        Assert.NotEqual(alpha, beta);
    }

    // rb:test cache.vary_many
    [Fact]
    [Trait("corpus", "cache.vary_many")]
    public async Task Each_of_three_vary_headers_keys_the_store()
    {
        (string, string)[] webEuAlpha = [("x-rb-channel", "web"), ("x-rb-region", "eu"), ("x-rb-tenant", "alpha")];
        (string, string)[] webEuBeta = [("x-rb-channel", "web"), ("x-rb-region", "eu"), ("x-rb-tenant", "beta")];

        long first = await Serial("/cache/vary/many", webEuAlpha);

        Assert.Equal(first, await Serial("/cache/vary/many", webEuAlpha));
        Assert.NotEqual(first, await Serial("/cache/vary/many", webEuBeta));
    }

    [Fact]
    public async Task The_answer_says_what_it_varies_on()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/cache/vary/many");

        Assert.Equal("x-rb-channel, x-rb-region, x-rb-tenant", Answer.Header(response, "vary"));
    }

    private async Task<long> Serial(string path, params (string Name, string Value)[] headers)
    {
        using HttpRequestMessage request = new(HttpMethod.Get, path);
        foreach ((string name, string value) in headers)
        {
            request.Headers.Add(name, value);
        }
        using HttpResponseMessage response = await app.CreateClient().SendAsync(request);
        return Answer.Serial(response);
    }
}
