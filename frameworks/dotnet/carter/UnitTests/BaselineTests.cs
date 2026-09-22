namespace UnitTests;

public sealed class BaselineTests(CarterApp app) : IClassFixture<CarterApp>
{
    [Fact]
    public async Task Plaintext_is_the_literal_as_text()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/plaintext");

        Assert.Equal("Hello, World!", await response.Content.ReadAsStringAsync());
        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);
    }
}
