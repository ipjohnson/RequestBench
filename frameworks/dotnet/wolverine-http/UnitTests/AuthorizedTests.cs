namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class AuthorizedTests(WolverineApp app)
{
    // rb:test authorized.allowed
    [Fact]
    [Trait("corpus", "authorized.allowed")]
    public async Task The_settings_token_is_let_through()
    {
        IScenarioResult result = await Ask($"Bearer {(string)Expected.Settings["token"]!}", HttpStatusCode.OK);

        Answer.Is(Expected.Json("items.small.json"), result);
    }

    // rb:test authorized.denied
    [Fact]
    [Trait("corpus", "authorized.denied")]
    public async Task A_token_one_character_off_is_forbidden_with_no_body()
    {
        IScenarioResult result = await Ask($"Bearer {(string)Expected.Settings["wrongToken"]!}", HttpStatusCode.Forbidden);

        Assert.Empty(Answer.Bytes(result));
    }

    [Fact]
    public async Task No_token_is_challenged()
    {
        await Ask(null, HttpStatusCode.Unauthorized);
    }

    private Task<IScenarioResult> Ask(string? authorization, HttpStatusCode status) => app.Host.Scenario(s =>
    {
        s.Get.Url("/authorized/small");
        if (authorization is not null)
        {
            s.WithRequestHeader("authorization", authorization);
        }
        s.StatusCodeShouldBe(status);
    });
}
