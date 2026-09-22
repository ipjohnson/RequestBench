namespace UnitTests;

public sealed class StaticTests(MinimalApisApp app) : IClassFixture<MinimalApisApp>
{
    // rb:test static.file
    [Fact]
    [Trait("corpus", "static.file")]
    public async Task The_file_is_sent_as_it_is_with_its_length_and_age()
    {
        using HttpResponseMessage response = await app.CreateClient().GetAsync("/static/items.large.json");

        byte[] file = Expected.Bytes("items.large.json");
        Assert.Equal(file, await response.Content.ReadAsByteArrayAsync());
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(file.Length, response.Content.Headers.ContentLength);
        Assert.NotNull(response.Content.Headers.LastModified);
    }
}
