using RequestBench.Domain;
using Scriban;

namespace RequestBench.Hosts;

/// <summary>
/// The one template engine every .NET target renders with, and the one template.
///
/// Pinned the way the gzip level is. An engine is a large constant factor, so six targets
/// on six engines would make template.small a comparison of engines with the framework
/// underneath it invisible.
///
/// Scriban renames members to snake_case in a template by default, so price_cents here is
/// the PriceCents on the record and the markup reads the same as every other language's.
/// </summary>
public static class Views
{
    private const string Items = """
        <!doctype html>
        <html>
          <head><title>items</title></head>
          <body>
            <h1>{{ size }}</h1>
            <table>
              <thead>
                <tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr>
              </thead>
              <tbody>
                {{ for it in items }}
                <tr>
                  <td>{{ it.id }}</td>
                  <td>{{ it.name }}</td>
                  <td>{{ it.category }}</td>
                  <td>{{ it.price_cents }}</td>
                  <td>{{ if it.in_stock }}yes{{ else }}no{{ end }}</td>
                </tr>
                {{ end }}
              </tbody>
            </table>
            <p>{{ count }} rows</p>
          </body>
        </html>
        """;

    /// <summary>Parsed once, rendered per request. A precomputed string would measure nothing.</summary>
    private static readonly Template Compiled = Template.Parse(Items);

    public static string RenderItems(PayloadBody body) => Compiled.Render(body);
}
