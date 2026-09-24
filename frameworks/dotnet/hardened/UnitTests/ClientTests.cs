using Client.Kiota;
using Client.Kiota.Models;

namespace UnitTests;

/// <summary>
/// The Kiota client in Client/, generated from the document Hardened's build writes, as a test
/// parameter that sends its requests through the pipeline. These hold the client to what Hardened
/// answers, not Hardened to a corpus row, so they carry no corpus trait.
/// </summary>
public class ClientTests
{
    [HardenedTest]
    public async Task Json_small_is_the_payload(HardenedClient client)
    {
        Payload? answer = await client.Json.Small.GetAsync();

        Assert.Equal(1, answer!.Count);
        Assert.Equal("slate-lamp-6647", answer.Items![0].Name);
    }

    [HardenedTest]
    public async Task A_replaced_item_is_typed(HardenedClient client)
    {
        Item? answer = await client.Items[17].PutAsync(new NewItem { Name = "amber-trowel-4410", Category = "garden", PriceCents = 2499, InStock = true });

        Assert.Equal(17, answer!.Id);
        Assert.Equal("amber-trowel-4410", answer.Name);
    }

    [HardenedTest]
    public async Task A_missing_row_is_the_typed_NotFound(HardenedClient client)
    {
        NotFound missing = await Assert.ThrowsAsync<NotFound>(() => client.Items[999999].GetAsync());

        Assert.Equal("item", missing.Resource);
    }

    [HardenedTest]
    public async Task Query_and_path_parameters_are_typed(HardenedClient client)
    {
        EchoedOfQueryOne? query = await client.Query.One.GetAsync(c => c.QueryParameters.Page = 417);
        EchoedOfParametersTwo? path = await client.Parameters[4821].WithSecond[7390].GetAsync();

        Assert.Equal(417, query!.Echo!.Page);
        Assert.Equal((4821, 7390), (path!.Echo!.One, path.Echo.Two));
    }
}
