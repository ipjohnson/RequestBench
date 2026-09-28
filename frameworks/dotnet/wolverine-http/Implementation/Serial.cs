using System.Globalization;

namespace Implementation;

/// <summary>
/// x-rb-serial: the Unix time in milliseconds, a bar, and one counter for the whole process.
/// A handler that writes it increments the counter and writes both, so an answer the output
/// cache replays carries the value it was stored with.
/// </summary>
public static class Serial
{
    private static long last;

    public static void Write(HttpResponse response) =>
        response.Headers["x-rb-serial"] = string.Create(
            CultureInfo.InvariantCulture, $"{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}|{Interlocked.Increment(ref last)}");
}
