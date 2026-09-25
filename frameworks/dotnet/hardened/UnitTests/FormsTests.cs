namespace UnitTests;

public class FormsTests
{
    // rb:test forms.urlencoded
    [ModuleTest]
    [Trait("corpus", "forms.urlencoded")]
    public async Task The_eight_fields_are_bound_and_echoed(ITestWebApp app)
    {
        TestWebResponse response = await app.Request("POST", null, "/forms/urlencoded", request =>
            request.RawBody("page=7&size=20&status=open&category=tools&sort=name&q=brass+lamp&minPrice=1000&maxPrice=20000", "application/x-www-form-urlencoded"));

        response.Assert.Ok();
        await Answer.Is(Expected.WithEcho("items.small.json", new JsonObject
        {
            ["page"] = 7, ["size"] = 20, ["status"] = "open", ["category"] = "tools",
            ["sort"] = "name", ["q"] = "brass lamp", ["minPrice"] = 1000, ["maxPrice"] = 20000,
        }), response);
    }

    // rb:test forms.multipart
    [ModuleTest]
    [Trait("corpus", "forms.multipart")]
    public async Task The_file_is_read_whole_and_the_fields_echoed(ITestWebApp app)
    {
        string file = System.Text.Encoding.UTF8.GetString(Expected.Bytes("forms.file.txt"));
        string body =
            "--rb\r\nContent-Disposition: form-data; name=\"tenant\"\r\n\r\ntenant\r\n" +
            "--rb\r\nContent-Disposition: form-data; name=\"requestId\"\r\n\r\n0123456789abcdef\r\n" +
            $"--rb\r\nContent-Disposition: form-data; name=\"file\"; filename=\"forms.file.txt\"\r\nContent-Type: text/plain\r\n\r\n{file}\r\n" +
            "--rb--\r\n";

        TestWebResponse response = await app.Request("POST", null, "/forms/multipart", request => request.RawBody(body, "multipart/form-data; boundary=rb"));

        response.Assert.Ok();
        await Answer.Is(new JsonObject
        {
            ["file"] = new JsonObject { ["name"] = "forms.file.txt", ["bytes"] = Expected.Bytes("forms.file.txt").Length },
            ["echo"] = new JsonObject { ["tenant"] = "tenant", ["requestId"] = "0123456789abcdef" },
        }, response);
    }
}
