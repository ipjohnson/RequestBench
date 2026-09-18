using RequestBench.Suite;

namespace RequestBench.MinimalApis.Suite;

/// <summary>
/// domain: the eight operations that reach the shared model, including the four that write.
///
/// The largest family and the one where a handler is doing something rather than returning
/// something. The writes are the ones a test earns its keep on: a 201 with no body and a 204
/// with no body are both answers a framework can get subtly wrong while returning the right
/// status, which is why the floor checks the kind of body even when there is none.
/// </summary>
public sealed class DomainTests(TargetApp app) : IClassFixture<TargetApp>
{
    // rb:test domain.lookup
    [Fact]
    public async Task One_order_is_looked_up()
    {
        Ask ask = Plan.For("domain.lookup");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test domain.filter
    [Fact]
    public async Task A_filtered_list_comes_back()
    {
        Ask ask = Plan.For("domain.filter");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test domain.join
    [Fact]
    public async Task A_join_across_the_model_comes_back()
    {
        Ask ask = Plan.For("domain.join");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test domain.aggregate
    [Fact]
    public async Task An_aggregate_is_computed()
    {
        Ask ask = Plan.For("domain.aggregate");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test domain.create
    [Fact]
    public async Task A_created_order_answers_201()
    {
        Ask ask = Plan.For("domain.create");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test domain.replace
    [Fact]
    public async Task A_replaced_customer_answers_the_new_state()
    {
        Ask ask = Plan.For("domain.replace");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test domain.patch
    [Fact]
    public async Task A_patched_customer_answers_the_merged_state()
    {
        Ask ask = Plan.For("domain.patch");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test domain.delete
    [Fact]
    public async Task A_deleted_line_answers_204_and_no_body()
    {
        Ask ask = Plan.For("domain.delete");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());
    }
}
