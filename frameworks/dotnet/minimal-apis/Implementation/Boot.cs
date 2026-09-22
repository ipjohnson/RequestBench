using System.Diagnostics;

namespace Implementation;

/// <summary>Milliseconds from the start of the process to the server listening, for /__meta.</summary>
public static class Boot
{
    public static double? Ms { get; private set; }

    /// <summary>Registered on ApplicationStarted, which ASP.NET Core raises once Kestrel has bound.</summary>
    public static void Listening()
    {
        using Process self = Process.GetCurrentProcess();
        Ms = Math.Round((DateTime.Now - self.StartTime).TotalMilliseconds, 1);
    }
}
