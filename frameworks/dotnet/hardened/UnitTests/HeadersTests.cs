namespace UnitTests;

public class HeadersTests
{
    /// <summary>Twenty-five more headers, as a browser and the proxies in front of it add.</summary>
    private static void Crowd(TestWebRequest request)
    {
        for (int i = 0; i < 25; i++)
        {
            request.Headers[$"x-rb-extra-{i}"] = "value";
        }
    }

    // rb:test headers.few,headers.many
    [ModuleTest]
    [Trait("corpus", "headers.few")]
    [Trait("corpus", "headers.many")]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Unread_headers_change_nothing(bool many, ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/headers", request =>
        {
            request.Headers["x-rb-tenant"] = "tenant";
            if (many)
            {
                Crowd(request);
            }
        });

        await Answer.Is(Expected.Json("items.small.json"), response);
    }

    // rb:test headers.bind_few,headers.bind_many
    [ModuleTest]
    [Trait("corpus", "headers.bind_few")]
    [Trait("corpus", "headers.bind_many")]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Three_headers_are_bound_and_echoed(bool many, ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/headers/bind", request =>
        {
            request.Headers["x-rb-tenant"] = "tenant";
            request.Headers["x-rb-request-id"] = "0123456789abcdef";
            request.Headers["x-rb-account"] = "123456";
            if (many)
            {
                Crowd(request);
            }
        });

        await Answer.Is(Expected.WithEcho("items.small.json", new JsonObject
        {
            ["tenant"] = "tenant", ["requestId"] = "0123456789abcdef", ["account"] = 123456,
        }), response);
    }

    [ModuleTest]
    public async Task An_account_that_is_not_a_number_is_refused(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/headers/bind", request =>
        {
            request.Headers["x-rb-tenant"] = "tenant";
            request.Headers["x-rb-request-id"] = "0123456789abcdef";
            request.Headers["x-rb-account"] = "many";
        });

        response.Assert.BadRequest();
    }
}
