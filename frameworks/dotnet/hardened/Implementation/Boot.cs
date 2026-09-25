using System.Diagnostics;

namespace Implementation;

/// <summary>Milliseconds from the start of the process to the server listening, for /__meta.</summary>
public static class Boot
{
    public static double? Ms { get; private set; }

    /// <summary>Called by a host's Program.cs once its server has started.</summary>
    public static void Listening()
    {
        using Process self = Process.GetCurrentProcess();
        Ms = Math.Round((DateTime.Now - self.StartTime).TotalMilliseconds, 1);
    }
}
