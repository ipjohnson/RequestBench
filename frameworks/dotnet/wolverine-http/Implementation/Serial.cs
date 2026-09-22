using System.Globalization;

namespace Implementation;

/// <summary>
/// x-rb-serial: one counter for the whole process. A handler that writes it increments it
/// and writes the new value, so an answer the output cache replays carries the value it was
/// stored with.
/// </summary>
public static class Serial
{
    private static long last;

    public static void Write(HttpResponse response) =>
        response.Headers["x-rb-serial"] = Interlocked.Increment(ref last).ToString(CultureInfo.InvariantCulture);
}
