using System.IO;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.Extensions.DependencyInjection;
using RequestBench.Domain;

namespace RequestBench.Hosts;

/// <summary>
/// The two caching facilities every .NET target wires, and the one piece it has to bring.
///
/// Response caching is ASP.NET Core's own: <c>AddOutputCache</c> stores the whole response
/// and replays it before the endpoint is reached, and its policies are where a row says
/// what its key is built from. Each target still wires it its own way.
///
/// Conditional requests are not. Nothing in ASP.NET Core computes a validator for a dynamic
/// response or answers <c>If-None-Match</c> against one: output caching does it only for a
/// response it already stored, and that is the opposite of what the etag rows measure. So
/// the middleware below is what five targets share, for the same reason <see cref="Views"/>
/// is one engine: five copies of a digest would drift, and the drift would read as a
/// framework result. Where they differ is where each attaches it, which is the part that
/// is actually the framework's.
/// </summary>
public static class Caching
{
    /// <summary>The policy name a row keyed by path alone caches under.</summary>
    public const string ByPath = "rb-by-path";

    /// <summary>The policy names the two vary rows cache under.</summary>
    public const string VaryOne = "rb-vary-one";
    public const string VaryMany = "rb-vary-many";

    /// <summary>
    /// The policy for one vary row by name, for a target that attaches it at runtime rather
    /// than as an attribute. Produces the two constants above.
    /// </summary>
    public static string VaryPolicy(string which) => "rb-vary-" + which;

    /// <summary>
    /// Output caching sized from the fixture: the key count it has to hold, an expiry past
    /// the end of a run, and one policy per shape a row is keyed by.
    ///
    /// SizeLimit is bytes rather than entries, so it is the large payload times the key
    /// count with room above it rather than the capacity itself. What the capacity governs
    /// here is that nothing is evicted, and a byte limit an order of magnitude over what
    /// the plan stores is the way to say that to this store.
    /// </summary>
    public static IServiceCollection AddRequestBenchOutputCache(
        this IServiceCollection services, DomainModel model)
    {
        var ttl = TimeSpan.FromSeconds(model.Cache.TtlS);
        return services.AddOutputCache(options =>
        {
            options.SizeLimit = 64L * 1024 * 1024;
            options.DefaultExpirationTimeSpan = ttl;
            options.AddPolicy(ByPath, builder => builder.Expire(ttl));
            foreach (string which in model.Cache.Vary.Keys)
            {
                string[] on = model.VaryOn(which);
                options.AddPolicy(VaryPolicy(which),
                                  builder => builder.SetVaryByHeader(on).Expire(ttl));
            }
        });
    }

    /// <summary>
    /// Write the validator for these bytes, and say whether the request already has it.
    ///
    /// Shallow, which is the point: the body is built and hashed before anything is
    /// compared, so a 304 saves the write and nothing else. Each target calls this from
    /// whichever hook it has -- an endpoint filter, an action filter, a post-processor --
    /// because that hook is the part that is actually the framework's.
    /// </summary>
    public static bool Revalidates(HttpContext context, ReadOnlySpan<byte> body)
    {
        string etag = DomainModel.ContentETag(body);
        context.Response.Headers.ETag = etag;
        context.Response.Headers.CacheControl = DomainModel.Cacheable;
        return context.Request.Headers.IfNoneMatch.ToString() == etag;
    }

    /// <summary>
    /// The same thing as pipeline middleware, for a target whose own hook does not see the
    /// bytes. The response is buffered because the digest is over them.
    /// </summary>
    public static async Task ConditionalGet(HttpContext context, Func<Task> next)
    {
        HttpResponse response = context.Response;
        Stream original = response.Body;
        using var buffer = new MemoryStream();
        response.Body = buffer;
        try
        {
            await next();
        }
        finally
        {
            response.Body = original;
        }

        byte[] body = buffer.ToArray();
        if (Revalidates(context, body))
        {
            response.StatusCode = StatusCodes.Status304NotModified;
            response.Headers.ContentLength = null;
            response.Headers.Remove("content-type");
            return;
        }
        response.Headers.ContentLength = body.Length;
        await original.WriteAsync(body);
    }
}
