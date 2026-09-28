namespace UnitTests;

public sealed class AuthorizedTests(CarterApp app) : IClassFixture<CarterApp>
{
    // rb:test authorized.allowed
    [Fact]
    [Trait("corpus", "authorized.allowed")]
    public async Task The_token_is_let_through()
    {
        using HttpResponseMessage response = await Ask("Bearer 5a7cc77ed0dcb825806b6f872026c317");

        await Answer.Is(Expected.Json("items.small.json"), response);
    }

    // rb:test authorized.denied
    [Fact]
    [Trait("corpus", "authorized.denied")]
    public async Task A_token_one_character_off_is_forbidden()
    {
        using HttpResponseMessage response = await Ask("Bearer 5a7cc77ed0dcb825806b6f872026c310");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(403, (int?)(await Answer.Json(response))["status"]);
    }

    [Fact]
    public async Task No_token_is_challenged()
    {
        using HttpResponseMessage response = await Ask(null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private Task<HttpResponseMessage> Ask(string? authorization)
    {
        HttpRequestMessage request = new(HttpMethod.Get, "/authorized/small");
        if (authorization is not null)
        {
            request.Headers.TryAddWithoutValidation("authorization", authorization);
        }
        return app.CreateClient().SendAsync(request);
    }
}
