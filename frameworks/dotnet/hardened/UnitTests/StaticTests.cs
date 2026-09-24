using System.IO.Compression;
using Hardened.Web.Kestrel.Runtime;

namespace UnitTests;

/// <summary>On Kestrel, so the headers are the ones the server sends.</summary>
[KestrelRuntime]
public class StaticTests
{
    // rb:test static.file
    [HardenedTest]
    [Trait("corpus", "static.file")]
    public async Task The_file_is_sent_with_its_modification_time(HttpClient client)
    {
        using HttpRequestMessage request = new(HttpMethod.Get, "/static/items.large.json");
        request.Headers.AcceptEncoding.ParseAdd("gzip");
        using HttpResponseMessage response = await client.SendAsync(request);

        Assert.Equal(["gzip"], response.Content.Headers.ContentEncoding);
        await using GZipStream unzipped = new(await response.Content.ReadAsStreamAsync(), CompressionMode.Decompress);
        using MemoryStream file = new();
        await unzipped.CopyToAsync(file);
        Assert.Equal(Expected.Bytes("items.large.json"), file.ToArray());
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.NotNull(response.Content.Headers.LastModified);
    }

    [HardenedTest]
    public async Task The_directory_is_served_under_static_alone(HttpClient client)
    {
        using HttpResponseMessage response = await client.GetAsync("/items.large.json");

        Assert.Equal(System.Net.HttpStatusCode.NotFound, response.StatusCode);
    }
}
