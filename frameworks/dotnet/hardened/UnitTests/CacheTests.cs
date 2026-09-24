using DependencyModules.Testing.Attributes;

namespace UnitTests;

/// <summary>
/// Each request through ITestWebApp runs in a container of its own unless the parameter is
/// [Shared], and the store lives in the container.
/// </summary>
public class CacheTests
{
    // rb:test cache.small,cache.medium,cache.large
    [HardenedTest]
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
    [HardenedTest]
    [Trait("corpus", "cache.vary_one")]
    public async Task One_vary_header_keys_the_store([Shared] ITestWebApp app)
    {
        long alpha = Answer.Serial(await app.Get("/cache/vary/one", request => request.Headers["x-rb-tenant"] = "alpha"));
        long beta = Answer.Serial(await app.Get("/cache/vary/one", request => request.Headers["x-rb-tenant"] = "beta"));

        Assert.Equal(alpha, Answer.Serial(await app.Get("/cache/vary/one", request => request.Headers["x-rb-tenant"] = "alpha")));
        Assert.NotEqual(alpha, beta);
    }

    // rb:test cache.vary_many
    [HardenedTest]
    [Trait("corpus", "cache.vary_many")]
    public async Task Each_of_three_vary_headers_keys_the_store([Shared] ITestWebApp app)
    {
        long first = Answer.Serial(await app.Get("/cache/vary/many", request => Vary(request, "alpha")));

        Assert.Equal(first, Answer.Serial(await app.Get("/cache/vary/many", request => Vary(request, "alpha"))));
        Assert.NotEqual(first, Answer.Serial(await app.Get("/cache/vary/many", request => Vary(request, "beta"))));
    }

    [HardenedTest]
    public async Task The_answer_says_what_it_varies_on(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/cache/vary/many");

        Assert.Equal("x-rb-channel, x-rb-region, x-rb-tenant", Answer.Header(response, "vary"));
    }

    private static void Vary(TestWebRequest request, string tenant)
    {
        request.Headers["x-rb-channel"] = "web";
        request.Headers["x-rb-region"] = "eu";
        request.Headers["x-rb-tenant"] = tenant;
    }
}
