namespace UnitTests;

public sealed class AuthorizedTests(App app) : TestBase<App>
{
    // rb:test authorized.allowed
    [Fact]
    [Trait("corpus", "authorized.allowed")]
    public async Task The_settings_token_is_let_through()
    {
        using HttpResponseMessage response = await AskAsync($"Bearer {(string)Expected.Settings["token"]!}");

        await Answer.IsAsync(Expected.Json("items.small.json"), response);
    }

    // rb:test authorized.denied
    [Fact]
    [Trait("corpus", "authorized.denied")]
    public async Task A_token_one_character_off_is_forbidden_with_no_body()
    {
        using HttpResponseMessage response = await AskAsync($"Bearer {(string)Expected.Settings["wrongToken"]!}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(await Answer.BytesAsync(response));
    }

    [Fact]
    public async Task No_token_is_challenged()
    {
        using HttpResponseMessage response = await AskAsync(null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task An_endpoint_that_names_no_policy_is_open()
    {
        using HttpResponseMessage response = await app.Client.GetAsync("/json/small", Cancellation);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private Task<HttpResponseMessage> AskAsync(string? authorization)
    {
        HttpRequestMessage request = new(HttpMethod.Get, "/authorized/small");
        if (authorization is not null)
        {
            request.Headers.TryAddWithoutValidation("authorization", authorization);
        }
        return app.Client.SendAsync(request, Cancellation);
    }
}
