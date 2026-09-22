using Client.Kiota;
using Client.Kiota.Models;
using Microsoft.Kiota.Abstractions;
using Microsoft.Kiota.Abstractions.Authentication;
using Microsoft.Kiota.Abstractions.Serialization;
using Microsoft.Kiota.Http.HttpClientLibrary;

namespace UnitTests;

/// <summary>
/// The Kiota client in Client/, generated from the document ASP.NET Core writes about Wolverine's
/// endpoints, calling the Implementation through Alba's test server. These hold the client to what
/// Wolverine answers, not Wolverine to a corpus row, so they carry no corpus trait.
/// </summary>
[Collection(nameof(WolverineApp))]
public sealed class ClientTests
{
    private readonly WolverineClient client;

    public ClientTests(WolverineApp app)
    {
        HttpClient http = app.Host.Server.CreateClient();
        // Building the client registers Kiota's JSON factories, which KiotaJsonSerializer reads.
        client = new WolverineClient(new HttpClientRequestAdapter(new AnonymousAuthenticationProvider(), httpClient: http)
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
    public async Task A_read_item_is_typed()
    {
        Item? answer = await client.Items[17].GetAsync();

        Assert.Equal(17, answer!.Id);
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
    public async Task A_missing_row_is_an_ApiException_with_the_status()
    {
        ApiException refused = await Assert.ThrowsAsync<ApiException>(() => client.Items[999999].GetAsync());

        Assert.Equal(404, refused.ResponseStatusCode);
    }

    [Fact]
    public async Task A_validated_order_is_bound()
    {
        ValidatedOrder order = await Read("order.small.json", ValidatedOrder.CreateFromDiscriminatorValue);

        Bound? answer = await client.Body.Validate.Small.PostAsync(order);

        Assert.Equal(4, answer!.Fields);
        Assert.Equal(order.CustomerId, answer.Echo!.CustomerId);
    }

    [Fact]
    public async Task A_rejected_order_is_the_validation_problem_the_document_declares()
    {
        ValidatedOrder order = await Read("order.invalid.json", ValidatedOrder.CreateFromDiscriminatorValue);

        HttpValidationProblemDetails refused = await Assert.ThrowsAsync<HttpValidationProblemDetails>(() => client.Body.Validate.Small.PostAsync(order));

        Assert.Equal(400, refused.Status);
        Assert.Equal(["CustomerId", "Status", "Lines"], refused.Errors!.AdditionalData.Keys);
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
