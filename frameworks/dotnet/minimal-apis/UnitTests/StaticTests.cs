namespace UnitTests;

public sealed class StaticTests(MinimalApisApp app) : IClassFixture<MinimalApisApp>
{
    // rb:test static.small,static.medium,static.large
    [Theory]
    [Trait("corpus", "static.small")]
    [Trait("corpus", "static.medium")]
    [Trait("corpus", "static.large")]
    [InlineData("items.small.json")]
    [InlineData("items.medium.json")]
    [InlineData("items.large.json")]
    public async Task The_file_is_sent_as_it_is_with_its_length_and_age(string name)
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync($"/static/{name}");

        byte[] file = Expected.Bytes(name);
        Assert.Equal(file, await response.Content.ReadAsByteArrayAsync());
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(file.Length, response.Content.Headers.ContentLength);
        Assert.NotNull(response.Content.Headers.LastModified);
    }
}
