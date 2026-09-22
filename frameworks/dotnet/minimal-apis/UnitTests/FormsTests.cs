using System.Net.Http.Headers;

namespace UnitTests;

public sealed class FormsTests(MinimalApisApp app) : IClassFixture<MinimalApisApp>
{
    // rb:test forms.urlencoded
    [Fact]
    [Trait("corpus", "forms.urlencoded")]
    public async Task A_urlencoded_form_binds_what_the_query_string_binds()
    {
        FormUrlEncodedContent form = new(QueryTests.Search().Select(pair => KeyValuePair.Create(pair.Key, pair.Value!.ToString())));

        using HttpResponseMessage response = await app.CreateClient().PostAsync("/forms/urlencoded", form);

        await Answer.Is(Expected.WithEcho("items.small.json", QueryTests.Search()), response);
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

        using HttpResponseMessage response = await app.CreateClient().PostAsync("/forms/multipart", form);

        JsonObject uploaded = new()
        {
            ["file"] = new JsonObject { ["name"] = "forms.file.txt", ["bytes"] = file.Length },
            ["echo"] = new JsonObject { ["tenant"] = "qwertyuiopas", ["requestId"] = "0123456789abcdef" },
        };
        await Answer.Is(uploaded, response);
    }
}
