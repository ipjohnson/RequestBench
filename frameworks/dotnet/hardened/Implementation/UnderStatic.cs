using Hardened.Web.StaticContent;

namespace Implementation;

// rb:handler static.file
// rb:wiring static.*
/// <summary>
/// The payload directory under /static. Hardened's static content mount answers at the
/// application's root, and its directory source takes no route prefix. The build-time manifest
/// takes one, but it reads its directory at build time, and the payloads are the directory
/// RB_PAYLOADS names at startup. So this source hands the directory source the path below /static
/// and declines every other path.
/// </summary>
public sealed class UnderStatic(FileSystemContentSource directory) : IStaticContentSource
{
    private const string Prefix = "/static";

    public bool Enabled => directory.Enabled;

    public StaticContentLocation? Locate(string requestPath) =>
        requestPath.StartsWith(Prefix + "/", StringComparison.Ordinal) ? directory.Locate(requestPath[Prefix.Length..]) : null;

    public ValueTask<StaticContentEntry?> Load(StaticContentLocation location) => directory.Load(location);
}
// rb:end
