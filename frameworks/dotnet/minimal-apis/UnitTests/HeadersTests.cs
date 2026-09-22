namespace UnitTests;

public sealed class HeadersTests(MinimalApisApp app) : IClassFixture<MinimalApisApp>
{
    // rb:test headers.few,headers.many
    [Theory]
    [Trait("corpus", "headers.few")]
    [Trait("corpus", "headers.many")]
    [InlineData(0)]
    [InlineData(25)]
    public async Task Headers_nothing_reads_leave_the_answer_alone(int unread)
    {
        using HttpRequestMessage request = Bound(new(HttpMethod.Get, "/headers"), unread);

        using HttpResponseMessage response = await app.CreateClient().SendAsync(request);

        await Answer.Is(Expected.Json("items.small.json"), response);
    }

    // rb:test headers.bind_few,headers.bind_many
    [Theory]
    [Trait("corpus", "headers.bind_few")]
    [Trait("corpus", "headers.bind_many")]
    [InlineData(0)]
    [InlineData(25)]
    public async Task Three_headers_are_bound_and_echoed_one_as_an_integer(int unread)
    {
        using HttpRequestMessage request = Bound(new(HttpMethod.Get, "/headers/bind"), unread);

        using HttpResponseMessage response = await app.CreateClient().SendAsync(request);

        JsonObject echo = new() { ["tenant"] = "qwertyuiopas", ["requestId"] = "0123456789abcdef", ["account"] = 482913 };
        await Answer.Is(Expected.WithEcho("items.small.json", echo), response);
    }

    /// <summary>
    /// The three headers the binding rows bind, and as many more as asked that nothing reads.
    /// The many rows send twenty-five of those.
    /// </summary>
    private static HttpRequestMessage Bound(HttpRequestMessage request, int unread)
    {
        request.Headers.Add("x-rb-tenant", "qwertyuiopas");
        request.Headers.Add("x-rb-request-id", "0123456789abcdef");
        request.Headers.Add("x-rb-account", "482913");
        for (int i = 0; i < unread; i++)
        {
            request.Headers.Add($"x-rb-unread-{i}", "unread");
        }
        return request;
    }
}
