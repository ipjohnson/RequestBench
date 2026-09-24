using System.Text;

namespace UnitTests;

public class FormsTests
{
    private const string Boundary = "rb-7c4f1e0a9d";

    // rb:test forms.urlencoded
    [HardenedTest]
    [Trait("corpus", "forms.urlencoded")]
    public async Task A_urlencoded_form_binds_what_the_query_string_binds(ITestWebApp app)
    {
        const string form = "page=417&size=38&status=paid&category=garden&sort=created&q=alpha+bravo&minPrice=1200&maxPrice=34000";

        TestWebResponse response = await app.Request("POST", null, "/forms/urlencoded", request => request.RawBody(form, "application/x-www-form-urlencoded"));

        await Answer.Is(Expected.WithEcho("items.small.json", QueryTests.Search()), response);
    }

    // rb:test forms.multipart
    [HardenedTest]
    [Trait("corpus", "forms.multipart")]
    public async Task A_multipart_upload_binds_two_fields_and_the_whole_file(ITestWebApp app)
    {
        byte[] file = Expected.Bytes("forms.file.txt");
        string body =
            $"--{Boundary}\r\nContent-Disposition: form-data; name=\"tenant\"\r\n\r\nqwertyuiopas\r\n" +
            $"--{Boundary}\r\nContent-Disposition: form-data; name=\"requestId\"\r\n\r\n0123456789abcdef\r\n" +
            $"--{Boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"forms.file.txt\"\r\nContent-Type: text/plain\r\n\r\n" +
            $"{Encoding.UTF8.GetString(file)}\r\n--{Boundary}--\r\n";

        TestWebResponse response = await app.Request("POST", null, "/forms/multipart", request => request.RawBody(Encoding.UTF8.GetBytes(body), $"multipart/form-data; boundary={Boundary}"));

        JsonObject uploaded = new()
        {
            ["file"] = new JsonObject { ["name"] = "forms.file.txt", ["bytes"] = file.Length },
            ["echo"] = new JsonObject { ["tenant"] = "qwertyuiopas", ["requestId"] = "0123456789abcdef" },
        };
        await Answer.Is(uploaded, response);
    }
}
