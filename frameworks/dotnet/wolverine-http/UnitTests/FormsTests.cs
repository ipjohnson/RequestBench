using System.Net.Http.Headers;

namespace UnitTests;

[Collection(nameof(WolverineApp))]
public sealed class FormsTests(WolverineApp app)
{
    // rb:test forms.urlencoded
    [Fact]
    [Trait("corpus", "forms.urlencoded")]
    public async Task A_urlencoded_form_binds_what_the_query_string_binds()
    {
        Dictionary<string, string> form = QueryTests.Search().ToDictionary(pair => pair.Key, pair => pair.Value!.ToString());

        IScenarioResult result = await app.Host.Scenario(s => s.Post.FormData(form).ToUrl("/forms/urlencoded"));

        Answer.Is(Expected.WithEcho("items.small.json", QueryTests.Search()), result);
    }

    // rb:test forms.multipart
    [Fact]
    [Trait("corpus", "forms.multipart")]
    public async Task A_multipart_upload_binds_two_fields_and_the_whole_file()
    {
        byte[] file = Expected.Bytes("forms.file.txt");
        ByteArrayContent part = new(file) { Headers = { ContentType = new MediaTypeHeaderValue("text/plain") } };
        using MultipartFormDataContent form = new()
        {
            { new StringContent("qwertyuiopas"), "tenant" },
            { new StringContent("0123456789abcdef"), "requestId" },
            { part, "file", "forms.file.txt" },
        };

        IScenarioResult result = await app.Host.Scenario(s => s.Post.MultipartFormData(form).ToUrl("/forms/multipart"));

        JsonObject uploaded = new()
        {
            ["file"] = new JsonObject { ["name"] = "forms.file.txt", ["bytes"] = file.Length },
            ["echo"] = new JsonObject { ["tenant"] = "qwertyuiopas", ["requestId"] = "0123456789abcdef" },
        };
        Answer.Is(uploaded, result);
    }
}
