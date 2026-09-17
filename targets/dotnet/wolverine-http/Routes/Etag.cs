using RequestBench.Domain;
using Wolverine.Http;

namespace RequestBench.WolverineTarget.Routes;

/// <summary>
/// etag: the framework's own conditional-request machinery, which ASP.NET Core does not
/// have. Nothing in it computes a validator for a dynamic response, so the digest is the
/// shared one and /__meta says so.
///
/// The hook is a pipeline branch on /etag rather than an endpoint filter: Wolverine compiles
/// its endpoints into their own delegates and writes the response from inside them, so the
/// branch is where the bytes actually are. Program.cs registers it.
/// </summary>
public static class EtagEndpoints
{
    // rb:wiring etag.*
    private static PayloadBody Serve(HttpContext context, DomainModel domain, string size)
    {
        context.Response.Headers["x-rb-serial"] = domain.NextSerial();
        return domain.Payload(size);
    }

    // rb:handler etag.*
    [WolverineGet("/etag/small")]
    public static PayloadBody Small(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "small");

    [WolverineGet("/etag/large")]
    public static PayloadBody Large(HttpContext context, DomainModel domain) =>
        Serve(context, domain, "large");
}
