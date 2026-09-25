namespace UnitTests;

/// <summary>
/// Each request goes to a container of its own unless the app is [Shared], and the store is a
/// singleton of the container, so these send every request to one.
/// </summary>
public class CacheTests
{
    // rb:test cache.small,cache.medium,cache.large
    [ModuleTest]
    [Trait("corpus", "cache.small")]
    [Trait("corpus", "cache.medium")]
    [Trait("corpus", "cache.large")]
    [InlineData("small")]
    [InlineData("medium")]
    [InlineData("large")]
    public async Task A_second_request_is_the_stored_answer(string size, [Shared] ITestWebApp app)
    {
        TestWebResponse first = await app.Get($"/cache/{size}");
        TestWebResponse second = await app.Get($"/cache/{size}");

        await Answer.Is(Expected.Json($"items.{size}.json"), second);
        Assert.Equal(Answer.Serial(first), Answer.Serial(second));
    }

    // rb:test cache.vary_one
    [ModuleTest]
    [Trait("corpus", "cache.vary_one")]
    public async Task One_vary_header_keys_the_store([Shared] ITestWebApp app)
    {
        long alpha = await Serial(app, "/cache/vary/one", ("x-rb-tenant", "alpha"));
        long beta = await Serial(app, "/cache/vary/one", ("x-rb-tenant", "beta"));

        Assert.Equal(alpha, await Serial(app, "/cache/vary/one", ("x-rb-tenant", "alpha")));
        Assert.NotEqual(alpha, beta);
    }

    // rb:test cache.vary_many
    [ModuleTest]
    [Trait("corpus", "cache.vary_many")]
    public async Task Each_of_three_vary_headers_keys_the_store([Shared] ITestWebApp app)
    {
        (string, string)[] webEuAlpha = [("x-rb-channel", "web"), ("x-rb-region", "eu"), ("x-rb-tenant", "alpha")];
        (string, string)[] webEuBeta = [("x-rb-channel", "web"), ("x-rb-region", "eu"), ("x-rb-tenant", "beta")];

        long first = await Serial(app, "/cache/vary/many", webEuAlpha);

        Assert.Equal(first, await Serial(app, "/cache/vary/many", webEuAlpha));
        Assert.NotEqual(first, await Serial(app, "/cache/vary/many", webEuBeta));
    }

    [ModuleTest]
    public async Task The_answer_says_what_it_varies_on(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/cache/vary/many");

        Assert.Equal("x-rb-channel, x-rb-region, x-rb-tenant", Answer.Header(response, "Vary"));
    }

    private static async Task<long> Serial(ITestWebApp app, string path, params (string Name, string Value)[] headers)
    {
        TestWebResponse response = await app.Get(path, request =>
        {
            foreach ((string name, string value) in headers)
            {
                request.Headers[name] = value;
            }
        });
        return Answer.Serial(response);
    }
}
