using Wolverine.Attributes;
using Wolverine.Http;

namespace Implementation.Endpoints;

/// <summary>
/// middleware: no-op layers in front of the handler. Wolverine middleware is a class whose Before
/// method the generated handler calls ahead of the endpoint, and [Middleware] names it on the
/// endpoint. Middleware added to the application would run on every route rather than on these two.
/// </summary>
public static class MiddlewareEndpoints
{
    [WolverineGet("/middleware/none")]
    public static Payload None(Payloads p) => p.Small;

    [WolverineGet("/middleware/four")]
    [Middleware(typeof(Noop), typeof(Noop), typeof(Noop), typeof(Noop))]
    public static Payload Four(Payloads p) => p.Small;

    [WolverineGet("/middleware/sixteen")]
    [Middleware(typeof(Noop), typeof(Noop), typeof(Noop), typeof(Noop), typeof(Noop), typeof(Noop), typeof(Noop), typeof(Noop),
                typeof(Noop), typeof(Noop), typeof(Noop), typeof(Noop), typeof(Noop), typeof(Noop), typeof(Noop), typeof(Noop))]
    public static Payload Sixteen(Payloads p) => p.Small;
}

// rb:wiring middleware.*
/// <summary>One layer. Each time [Middleware] names it, the handler calls Before once more.</summary>
public static class Noop
{
    public static void Before()
    {
    }
}
