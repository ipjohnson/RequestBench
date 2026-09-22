using Client.Kiota;
using Client.Kiota.Models;
using Microsoft.Kiota.Abstractions.Authentication;
using Microsoft.Kiota.Abstractions.Serialization;
using Microsoft.Kiota.Http.HttpClientLibrary;

namespace UnitTests;

/// <summary>
/// The Kiota client in Client/, which FastEndpoints.OpenApi.Kiota generates from the document
/// FastEndpoints.OpenApi writes, calling the Implementation in the test host. These hold the
/// client to what FastEndpoints answers, not FastEndpoints to a corpus row, so they carry no
/// corpus trait.
/// </summary>
public sealed class ClientTests : TestBase<App>
{
    private readonly FastEndpointsClient client;

    public ClientTests(App app)
    {
        HttpClient http = app.CreateClient();
        // Building the client registers Kiota's JSON factories, which KiotaJsonSerializer reads.
        client = new FastEndpointsClient(new HttpClientRequestAdapter(new AnonymousAuthenticationProvider(), httpClient: http)
        {
            BaseUrl = http.BaseAddress!.ToString().TrimEnd('/'),
        });
    }

    [Fact]
    public async Task Json_small_is_the_payload()
    {
        Payload? answer = await client.Json.Small.GetAsync(cancellationToken: Cancellation);

        JsonNode actual = JsonNode.Parse(await KiotaJsonSerializer.SerializeAsStringAsync(answer!, serializeOnlyChangedValues: false, cancellationToken: Cancellation))!;
        Assert.True(JsonNode.DeepEquals(Expected.Json("items.small.json"), actual), actual.ToJsonString());
    }

    [Fact]
    public async Task A_read_item_is_typed_because_the_endpoint_names_its_response()
    {
        Item? answer = await client.Items[17].GetAsync(cancellationToken: Cancellation);

        Assert.Equal(17, answer!.Id);
    }

    [Fact]
    public async Task A_replaced_item_is_typed()
    {
        ReplacedItem item = await ReadAsync("items.new.json", ReplacedItem.CreateFromDiscriminatorValue);

        Item? answer = await client.Items[17].PutAsync(item, cancellationToken: Cancellation);

        Assert.Equal(17, answer!.Id);
        Assert.Equal(item.Name, answer.Name);
    }

    [Fact]
    public async Task A_validated_order_is_bound()
    {
        CheckedOrder order = await ReadAsync("order.small.json", CheckedOrder.CreateFromDiscriminatorValue);

        Bound? answer = await client.Body.Validate.Small.PostAsync(order, cancellationToken: Cancellation);

        Assert.Equal(4, answer!.Fields);
        Assert.Equal(order.CustomerId, answer.Echo!.CustomerId);
    }

    [Fact]
    public async Task A_rejected_order_is_FastEndpoints_ErrorResponse_thrown_as_an_exception()
    {
        CheckedOrder order = await ReadAsync("order.invalid.json", CheckedOrder.CreateFromDiscriminatorValue);

        ErrorResponse refused = await Assert.ThrowsAsync<ErrorResponse>(() => client.Body.Validate.Small.PostAsync(order, cancellationToken: Cancellation));

        Assert.Equal(400, refused.ResponseStatusCode);
        Assert.Equal(["customerId", "status", "lines"], refused.Errors!.AdditionalData.Keys);
    }

    [Fact]
    public async Task Query_and_path_parameters_are_typed()
    {
        EchoedOfQueryOne? query = await client.Query.One.GetAsync(c => c.QueryParameters.Page = 417, Cancellation);
        EchoedOfParametersTwo? path = await client.Parameters[4821].WithSecond[7390].GetAsync(cancellationToken: Cancellation);

        Assert.Equal("small", query!.Size);
        Assert.Equal("small", path!.Size);
    }

    /// <summary>A committed payload, read into the client's own model.</summary>
    private static async Task<T> ReadAsync<T>(string file, ParsableFactory<T> factory) where T : IParsable =>
        (await KiotaJsonSerializer.DeserializeAsync(File.ReadAllText(Path.Combine(Expected.Directory, file)), factory, TestContext.Current.CancellationToken))!;
}
