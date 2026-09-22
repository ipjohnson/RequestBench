namespace UnitTests;

public sealed class HeadersTests(CarterApp app) : IClassFixture<CarterApp>
{
    [Fact]
    public async Task Headers_nothing_reads_leave_the_answer_alone()
    {
        using HttpRequestMessage request = Bound(new(HttpMethod.Get, "/headers"));

        using HttpResponseMessage response = await app.CreateClient().SendAsync(request);

        await Answer.Is(Expected.Json("items.small.json"), response);
    }

    [Fact]
    public async Task Three_headers_are_bound_and_echoed_one_as_an_integer()
    {
        using HttpRequestMessage request = Bound(new(HttpMethod.Get, "/headers/bind"));

        using HttpResponseMessage response = await app.CreateClient().SendAsync(request);

        JsonObject echo = new() { ["tenant"] = "qwertyuiopas", ["requestId"] = "0123456789abcdef", ["account"] = 482913 };
        await Answer.Is(Expected.WithEcho("items.small.json", echo), response);
    }

    private static HttpRequestMessage Bound(HttpRequestMessage request)
    {
        request.Headers.Add("x-rb-tenant", "qwertyuiopas");
        request.Headers.Add("x-rb-request-id", "0123456789abcdef");
        request.Headers.Add("x-rb-account", "482913");
        return request;
    }
}
