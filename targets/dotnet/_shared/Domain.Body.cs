using System.Text.Json;

namespace RequestBench.Domain;

/// <summary>
/// body: the parser and the validator. Error field order matches what spec/expected.json
/// records, so a reordered check here is a test failure rather than a preference.
/// </summary>
public sealed partial class DomainModel
{
    /// <summary>
    /// Walks the parsed body. Without a field derived from the parsed structure a target can
    /// pipe request bytes straight to the response and never parse, and the gate would not
    /// see it: the comparison is over parsed values, so even a reordering is invisible.
    /// </summary>
    public static int LeafCount(JsonElement v) => v.ValueKind switch
    {
        JsonValueKind.Object => v.EnumerateObject().Sum(p => LeafCount(p.Value)),
        JsonValueKind.Array => v.EnumerateArray().Sum(LeafCount),
        _ => 1,
    };

    public static BindResult BindEcho(JsonElement body) =>
        new(LeafCount(body), Json.Bytes(body).Length, body);

    /// <summary>
    /// Integral in the way Number.isInteger is: a JSON number with nothing after the point.
    /// True and "3" are not numbers and do not pass.
    /// </summary>
    private static bool IsInt(JsonElement? v) =>
        v is { ValueKind: JsonValueKind.Number } n && n.TryGetDouble(out double d)
        && d == Math.Truncate(d);

    private static JsonElement? Field(JsonElement body, string name) =>
        body.ValueKind == JsonValueKind.Object && body.TryGetProperty(name, out JsonElement v)
            ? v : null;

    // ---- the order body, after validation --------------------------------------------
    //
    // Validating is the framework's own job and lives in each target: aspnet-mvc and
    // minimal-apis annotate a record for DataAnnotations, fastendpoints declares a
    // FluentValidation Validator, carter runs one itself, and wolverine-http puts one in
    // its middleware. What is left here is what happens once a body is known to be good,
    // which is the same work whichever framework proved it.

    /// <summary>One order line as it arrived, before pricing.</summary>
    public readonly record struct LineInput(int ProductId, int Qty);

    /// <summary>
    /// The work after the validator says yes: look each product up, carry the unit price
    /// onto the line, and total it. Identical in every framework, which is why it is here
    /// and the validating is not.
    /// </summary>
    public ValidatedOrder PriceOrder(int customerId, string status, IReadOnlyList<LineInput> input)
    {
        List<Line> lines = [];
        int total = 0;
        int index = 0;
        foreach (LineInput l in input)
        {
            int unit = _productById.TryGetValue(l.ProductId, out Product? p) ? p.PriceCents : 0;
            lines.Add(new Line(++index, l.ProductId, l.Qty, unit, unit * l.Qty));
            total += unit * l.Qty;
        }
        return new ValidatedOrder(null, customerId, status, lines, total);
    }

    public Customer PatchCustomer(string cid, JsonElement body)
    {
        if (!int.TryParse(cid, out int id) || !_customerById.TryGetValue(id, out Customer? c))
        {
            throw NotFoundException.Instance;
        }
        string? name = Field(body, "name")?.GetString();
        string? region = Field(body, "region")?.GetString();
        return c with
        {
            Name = string.IsNullOrEmpty(name) ? c.Name : name,
            Region = string.IsNullOrEmpty(region) ? c.Region : region,
        };
    }
}
