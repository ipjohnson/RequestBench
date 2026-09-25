using Hardened.Web.Kestrel.Runtime;

namespace UnitTests;

/// <summary>On a Kestrel socket, so the headers are what the server sent with the file.</summary>
[KestrelRuntime]
public class StaticTests
{
    // rb:test static.file
    [ModuleTest]
    [Trait("corpus", "static.file")]
    public async Task The_file_is_served_as_it_is_committed(ITestWebApp app)
    {
        TestWebResponse response = await app.Get("/static/items.large.json", request => request.Headers["Accept-Encoding"] = "gzip");

        response.Assert.Ok();
        Assert.StartsWith("application/json", Answer.Header(response, "Content-Type"));
        Assert.NotNull(Answer.Header(response, "Last-Modified"));
        Assert.Equal(System.Text.Encoding.UTF8.GetString(Expected.Bytes("items.large.json")), await response.ReadTextAsync());
    }

    [ModuleTest]
    public async Task Nothing_outside_the_prefix_is_served(ITestWebApp app)
    {
        (await app.Get("/items.large.json")).Assert.NotFound();
    }
}
