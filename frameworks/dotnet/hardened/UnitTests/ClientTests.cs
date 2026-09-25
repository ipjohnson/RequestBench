using Client.Kiota;
using Hardened.Web.Runtime.Responses;
using ClientModels = Client.Kiota.Models;

namespace UnitTests;

/// <summary>
/// The Kiota client in Client/, generated from the document Hardened's build writes, sending
/// into the pipeline through [KiotaTesting]. These hold the client to what Hardened answers, not
/// Hardened to a corpus row, so they carry no corpus trait.
/// </summary>
public class ClientTests
{
    [ModuleTest]
    public async Task Json_small_is_the_payload(HardenedClient client)
    {
        Ok<ClientModels.Payload> answer = await client.Json.Small.GetAsync().Returns<Ok<ClientModels.Payload>>();

        Assert.Equal("small", answer.Value.Size);
        Assert.Equal(1, answer.Value.Items!.Single().Id);
    }

    [ModuleTest]
    public async Task A_created_item_answers_its_location(HardenedClient client)
    {
        Created<ClientModels.Item> created = await client.Items
            .PostAsync(new ClientModels.NewItem { Name = "amber-trowel-4410", Category = "garden", PriceCents = 2499, InStock = true })
            .Returns<Created<ClientModels.Item>>();

        Assert.Equal($"/items/{created.Value.Id}", created.Location);
    }

    [ModuleTest]
    public async Task A_missing_item_is_a_typed_not_found(HardenedClient client)
    {
        NotFound<ClientModels.NotFound> missing = await client.Items[999999].GetAsync().Returns<NotFound<ClientModels.NotFound>>();

        Assert.Contains("999999", missing.Body.Detail);
    }

    [ModuleTest]
    public async Task A_broken_order_is_a_typed_bad_request(HardenedClient client)
    {
        BadRequest<ClientModels.RequestValidationError> refused = await client.Body.Validate.Small
            .PostAsync(new ClientModels.OrderRequest { CustomerId = 0, Status = "", Lines = [] })
            .Returns<BadRequest<ClientModels.RequestValidationError>>();

        Assert.Equal(3, refused.Body.Errors!.Count);
    }

    [ModuleTest]
    public async Task Eight_query_values_are_echoed(HardenedClient client)
    {
        ClientModels.EchoedOfSearch? answer = await client.Query.Many.GetAsync(request =>
        {
            request.QueryParameters.Page = 1;
            request.QueryParameters.Size = 20;
            request.QueryParameters.Status = "open";
            request.QueryParameters.Category = "tools";
            request.QueryParameters.Sort = "name";
            request.QueryParameters.Q = "brass";
            request.QueryParameters.MinPrice = 100;
            request.QueryParameters.MaxPrice = 200;
        });

        Assert.Equal("brass", answer!.Echo!.Q);
    }
}
