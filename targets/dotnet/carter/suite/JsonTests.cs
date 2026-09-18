
namespace RequestBench.CarterTarget.Suite;

/// <summary>
/// json: serialization cost at three sizes, and nothing else in the path.
///
/// The three differ only in how much there is to serialize, so there is nothing here a test
/// can say that the floor does not already say better: the pinned body is the whole contract.
/// What the three tests are for is the ratchet. An endpoint with no test is counted, and
/// three that pass at three sizes is how a serializer that truncates the large one is caught.
/// </summary>
public sealed class JsonTests(TargetApp app) : IClassFixture<TargetApp>
{
    // rb:test json.small
    [Fact]
    public async Task The_small_payload_serializes_to_what_the_spec_pins()
    {
        Ask ask = Plan.For("json.small");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test json.medium
    [Fact]
    public async Task The_medium_payload_does_too()
    {
        Ask ask = Plan.For("json.medium");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }

    // rb:test json.large
    [Fact]
    public async Task And_the_large_one_which_is_where_a_truncation_would_show()
    {
        Ask ask = Plan.For("json.large");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }
}
