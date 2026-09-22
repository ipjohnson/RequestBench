namespace Implementation.Routes;

/// <summary>
/// query: query string values bound by declaring them on the handler, where the name and the
/// type are the binding.
/// </summary>
public static class QueryRoutes
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/query/one", (int page, Payloads p) => new Echoed<QueryOne>(p.Small, new(page)));

        app.MapGet("/query/many", (int page, int size, string status, string category, string sort, string q, int minPrice, int maxPrice, Payloads p) =>
            new Echoed<Search>(p.Small, new(page, size, status, category, sort, q, minPrice, maxPrice)));
    }
}
