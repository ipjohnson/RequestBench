namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class HeadersTests(WolverineApp app)
{
    // rb:test headers.few,headers.many
    [Theory]
    [Trait("corpus", "headers.few")]
    [Trait("corpus", "headers.many")]
    [InlineData(0)]
    [InlineData(25)]
    public async Task Headers_nothing_reads_leave_the_answer_alone(int unread)
    {
        IScenarioResult result = await app.Host.Scenario(s => Bound(s, "/headers", unread));

        Answer.Is(Expected.Json("items.small.json"), result);
    }

    // rb:test headers.bind_few,headers.bind_many
    [Theory]
    [Trait("corpus", "headers.bind_few")]
    [Trait("corpus", "headers.bind_many")]
    [InlineData(0)]
    [InlineData(25)]
    public async Task Three_headers_are_bound_and_echoed_one_as_an_integer(int unread)
    {
        IScenarioResult result = await app.Host.Scenario(s => Bound(s, "/headers/bind", unread));

        JsonObject echo = new() { ["tenant"] = "qwertyuiopas", ["requestId"] = "0123456789abcdef", ["account"] = 482913 };
        Answer.Is(Expected.WithEcho("items.small.json", echo), result);
    }

    /// <summary>
    /// The three headers the binding rows bind, and as many more as asked that nothing reads.
    /// The many rows send twenty-five of those.
    /// </summary>
    private static void Bound(Scenario s, string path, int unread)
    {
        s.Get.Url(path);
        s.WithRequestHeader("x-rb-tenant", "qwertyuiopas");
        s.WithRequestHeader("x-rb-request-id", "0123456789abcdef");
        s.WithRequestHeader("x-rb-account", "482913");
        for (int i = 0; i < unread; i++)
        {
            s.WithRequestHeader($"x-rb-unread-{i}", "unread");
        }
    }
}
