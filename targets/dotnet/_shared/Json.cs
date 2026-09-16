using System.Text.Json;

namespace RequestBench.Domain;

/// <summary>
/// One serializer configuration for every target, so the measured delta is the framework
/// binding to it rather than two targets spelling a field differently.
/// </summary>
public static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
    };

    public static byte[] Bytes<T>(T value) => JsonSerializer.SerializeToUtf8Bytes(value, Options);
}
