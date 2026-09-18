using RequestBench.Suite;

namespace RequestBench.MinimalApis.Suite;

/// <summary>
/// template: server-side HTML, at two sizes.
///
/// The one family whose body is not compared byte for byte. Five template engines cannot
/// agree on formatting without every template being contorted to match, so the spec pins the
/// content and leaves the whitespace free: same elements, same order, same values. The floor
/// normalises both sides the way the conformance client does.
/// </summary>
public sealed class TemplateTests(TargetApp app) : IClassFixture<TargetApp>
{
    // rb:test template.small
    [Fact]
    public async Task The_small_template_renders_the_pinned_content()
    {
        Ask ask = Plan.For("template.small");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
    }

    // rb:test template.medium
    [Fact]
    public async Task The_medium_template_does_too()
    {
        Ask ask = Plan.For("template.medium");

        using HttpResponseMessage response = await app.Send(ask);

        await Floor.AssertAsync(response, ask);
    }
}
