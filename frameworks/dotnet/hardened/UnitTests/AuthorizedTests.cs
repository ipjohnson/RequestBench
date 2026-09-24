namespace UnitTests;

public class AuthorizedTests
{
    // rb:test authorized.allowed
    [HardenedTest]
    [Trait("corpus", "authorized.allowed")]
    public async Task The_settings_token_is_let_through(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/authorized/small", request => request.Headers["Authorization"] = $"Bearer {(string)Expected.Settings["token"]!}");

        await Answer.Is(Expected.Json("items.small.json"), response);
    }

    // rb:test authorized.denied
    [HardenedTest]
    [Trait("corpus", "authorized.denied")]
    public async Task A_token_one_character_off_is_authenticated_and_forbidden(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/authorized/small", request => request.Headers["Authorization"] = $"Bearer {(string)Expected.Settings["wrongToken"]!}");

        response.Assert.Forbidden();
        Assert.Equal("AuthorizationException", (string?)(await Answer.Json(response))["type"]);
    }

    [HardenedTest]
    public async Task No_token_is_challenged(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/authorized/small");

        response.Assert.Unauthorized();
        Assert.Equal("Bearer", Answer.Header(response, "www-authenticate"));
    }
}
