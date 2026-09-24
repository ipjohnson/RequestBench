namespace UnitTests;

public class HeadersTests
{
    // rb:test headers.few,headers.many
    [HardenedTest]
    [Trait("corpus", "headers.few")]
    [Trait("corpus", "headers.many")]
    [InlineData(0)]
    [InlineData(25)]
    public async Task Headers_nothing_reads_leave_the_answer_alone(int unread, ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/headers", request => Bound(request, unread));

        await Answer.Is(Expected.Json("items.small.json"), response);
    }

    // rb:test headers.bind_few,headers.bind_many
    [HardenedTest]
    [Trait("corpus", "headers.bind_few")]
    [Trait("corpus", "headers.bind_many")]
    [InlineData(0)]
    [InlineData(25)]
    public async Task Three_headers_are_bound_and_echoed_one_as_an_integer(int unread, ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/headers/bind", request => Bound(request, unread));

        JsonObject echo = new() { ["tenant"] = "qwertyuiopas", ["requestId"] = "0123456789abcdef", ["account"] = 482913 };
        await Answer.Is(Expected.WithEcho("items.small.json", echo), response);
    }

    /// <summary>
    /// The three headers the binding rows bind, and as many more as asked that nothing reads.
    /// The many rows send twenty-five of those.
    /// </summary>
    private static void Bound(TestWebRequest request, int unread)
    {
        request.Headers["x-rb-tenant"] = "qwertyuiopas";
        request.Headers["x-rb-request-id"] = "0123456789abcdef";
        request.Headers["x-rb-account"] = "482913";
        for (int i = 0; i < unread; i++)
        {
            request.Headers[$"x-rb-unread-{i}"] = "unread";
        }
    }
}
