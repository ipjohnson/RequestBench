using Client.Kiota;
using Client.Kiota.Models;
using Microsoft.Kiota.Abstractions;
using Microsoft.Kiota.Abstractions.Authentication;
using Microsoft.Kiota.Abstractions.Serialization;
using Microsoft.Kiota.Http.HttpClientLibrary;

namespace UnitTests;

/// <summary>
/// The Kiota client in Client/, generated from the document the Implementation's build writes,
/// calling the Implementation in the test host. These hold the client to what minimal APIs answer,
/// not minimal APIs to a corpus row, so they carry no corpus trait.
/// </summary>
public sealed class ClientTests : IClassFixture<MinimalApisApp>
{
    private readonly MinimalApisClient client;

    public ClientTests(MinimalApisApp app)
    {
        HttpClient http = app.CreateClient();
        // Building the client registers Kiota's JSON factories, which KiotaJsonSerializer reads.
        client = new MinimalApisClient(new HttpClientRequestAdapter(new AnonymousAuthenticationProvider(), httpClient: http)
        {
            BaseUrl = http.BaseAddress!.ToString().TrimEnd('/'),
        });
    }

    [Fact]
    public async Task Json_small_is_the_payload()
    {
        Payload? answer = await client.Json.Small.GetAsync();

        JsonNode actual = JsonNode.Parse(await KiotaJsonSerializer.SerializeAsStringAsync(answer!))!;
        Assert.True(JsonNode.DeepEquals(Expected.Json("items.small.json"), actual), actual.ToJsonString());
    }

    [Fact]
    public async Task A_replaced_item_is_typed()
    {
        NewItem item = await Read("items.new.json", NewItem.CreateFromDiscriminatorValue);

        Item? answer = await client.Items[17].PutAsync(item);

        Assert.Equal(17, answer!.Id);
        Assert.Equal(item.Name, answer.Name);
    }

    [Fact]
    public async Task A_read_item_is_a_stream_because_the_route_returns_IResult()
    {
        Stream? answer = await client.Items[17].GetAsync();

        JsonNode row = JsonNode.Parse(answer!)!;
        Assert.Equal(17, (int)row["id"]!);
    }

    [Fact]
    public async Task A_validated_order_is_bound()
    {
        OrderRequest order = await Read("order.small.json", OrderRequest.CreateFromDiscriminatorValue);

        Bound? answer = await client.Body.Validate.Small.PostAsync(order);

        Assert.Equal(4, answer!.Fields);
        Assert.Equal(order.CustomerId, answer.Echo!.CustomerId);
    }

    [Fact]
    public async Task A_rejected_order_is_an_ApiException_with_the_status()
    {
        OrderRequest order = await Read("order.invalid.json", OrderRequest.CreateFromDiscriminatorValue);

        ApiException refused = await Assert.ThrowsAsync<ApiException>(() => client.Body.Validate.Small.PostAsync(order));

        Assert.Equal(400, refused.ResponseStatusCode);
    }

    [Fact]
    public async Task Query_and_path_parameters_are_typed()
    {
        EchoedOfQueryOne? query = await client.Query.One.GetAsync(c => c.QueryParameters.Page = 417);
        EchoedOfParametersTwo? path = await client.Parameters[4821].WithSecond[7390].GetAsync();

        Assert.Equal(417, query!.Echo!.Page);
        Assert.Equal((4821, 7390), (path!.Echo!.One, path.Echo.Two));
    }

    /// <summary>A committed payload, read into the client's own model.</summary>
    private static async Task<T> Read<T>(string file, ParsableFactory<T> factory) where T : IParsable =>
        (await KiotaJsonSerializer.DeserializeAsync(File.ReadAllText(Path.Combine(Expected.Directory, file)), factory))!;
}
