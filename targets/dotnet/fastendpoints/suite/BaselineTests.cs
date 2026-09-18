using FastEndpoints.Testing;
using RequestBench.Suite;
using Xunit;

namespace RequestBench.FastEndpointsTarget.Suite;

/// <summary>
/// baseline: the dispatch floor, with no serialization in the way.
///
/// The one endpoint in the corpus that answers a literal. Its whole contract is the string
/// and the content type, and the content type is the half a test gets wrong: a target that
/// answers "Hello, World!" as application/json has passed the body and failed the endpoint.
/// The floor checks the kind of body before the body for that reason.
/// </summary>
public sealed class BaselineTests(TargetApp app) : TestBase<TargetApp>
{
    // rb:test baseline.plaintext
    [Fact]
    public async Task The_plaintext_route_answers_a_literal_as_text()
    {
        Ask ask = Plan.For("baseline.plaintext");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);
    }
}
