namespace UnitTests;

public class AuthorizedTests
{
    private static string Token(string name) => (string)Expected.Settings[name]!;

    // rb:test authorized.allowed
    [ModuleTest]
    [Trait("corpus", "authorized.allowed")]
    public async Task The_settings_token_is_let_through(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/authorized/small", request => request.Headers["Authorization"] = $"Bearer {Token("token")}");

        response.Assert.Ok();
        await Answer.Is(Expected.Json("items.small.json"), response);
    }

    // rb:test authorized.denied
    [ModuleTest]
    [Trait("corpus", "authorized.denied")]
    public async Task A_token_one_character_off_is_forbidden(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/authorized/small", request => request.Headers["Authorization"] = $"Bearer {Token("wrongToken")}");

        response.Assert.Forbidden();
    }

    [ModuleTest]
    public async Task No_token_is_unauthorized(ITestWebApp app)
    {
        (await app.Get("/authorized/small")).Assert.Unauthorized();
    }
}
