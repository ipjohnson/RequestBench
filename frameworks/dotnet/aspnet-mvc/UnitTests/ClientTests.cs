using Client.Kiota;
using Client.Kiota.Models;
using Microsoft.Kiota.Abstractions;
using Microsoft.Kiota.Abstractions.Authentication;
using Microsoft.Kiota.Abstractions.Serialization;
using Microsoft.Kiota.Http.HttpClientLibrary;

namespace UnitTests;

/// <summary>
/// The Kiota client in Client/, generated from the document MVC's build writes, calling the
/// Implementation in the test host. These hold the client to what MVC answers, not MVC to a
/// corpus row, so they carry no corpus trait.
/// </summary>
public sealed class ClientTests : IClassFixture<MvcApp>
{
    private readonly AspNetMvcClient client;

    public ClientTests(MvcApp app)
    {
        HttpClient http = app.CreateClient();
        // Building the client registers Kiota's JSON factories, which KiotaJsonSerializer reads.
        client = new AspNetMvcClient(new HttpClientRequestAdapter(new AnonymousAuthenticationProvider(), httpClient: http)
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
    public async Task A_read_item_is_typed_because_the_action_returns_ActionResult_of_Item()
    {
        Item? answer = await client.Items[17].GetAsync();

        Assert.Equal(17, answer!.Id);
    }

    [Fact]
    public async Task A_created_item_is_read_from_the_201_although_the_document_says_200()
    {
        NewItem item = await Read("items.new.json", NewItem.CreateFromDiscriminatorValue);

        Item? answer = await client.Items.PostAsync(item);

        Assert.Equal(1426, answer!.Id);
        Assert.Equal(item.Name, answer.Name);
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

    [Fact]
    public async Task The_eight_query_values_bind_under_the_names_the_document_gives_them()
    {
        EchoedOfSearch? answer = await client.Query.Many.GetAsync(c =>
        {
            c.QueryParameters.Page = 417;
            c.QueryParameters.Size = 38;
            c.QueryParameters.Status = "paid";
            c.QueryParameters.Category = "garden";
            c.QueryParameters.Sort = "created";
            c.QueryParameters.Q = "alpha bravo";
            c.QueryParameters.MinPrice = 1200;
            c.QueryParameters.MaxPrice = 34000;
        });

        JsonNode echo = JsonNode.Parse(await KiotaJsonSerializer.SerializeAsStringAsync(answer!.Echo!))!;
        Assert.True(JsonNode.DeepEquals(QueryTests.Search(), echo), echo.ToJsonString());
    }

    /// <summary>A committed payload, read into the client's own model.</summary>
    private static async Task<T> Read<T>(string file, ParsableFactory<T> factory) where T : IParsable =>
        (await KiotaJsonSerializer.DeserializeAsync(File.ReadAllText(Path.Combine(Expected.Directory, file)), factory))!;
}
