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

    private static void Require(List<FieldError> errs, JsonElement body, string field, string type)
    {
        JsonElement? v = Field(body, field);
        if (v is null || v.Value.ValueKind == JsonValueKind.Null)
        {
            errs.Add(new FieldError(field, "required"));
            return;
        }
        bool ok = type switch
        {
            "int" => IsInt(v),
            "string" => v.Value.ValueKind == JsonValueKind.String,
            "array" => v.Value.ValueKind == JsonValueKind.Array,
            _ => true,
        };
        if (!ok)
        {
            errs.Add(new FieldError(field, type));
        }
    }

    /// <summary>
    /// Reports every problem it finds, or stops at the first, which is what
    /// body.rejected_all minus body.rejected_first states as a number: the same walk in the
    /// same order, differing only in where it gives up.
    /// </summary>
    public ValidatedOrder ValidateOrder(JsonElement body, bool firstError = false)
    {
        List<FieldError> errs = [];
        bool Bail() => firstError && errs.Count > 0;

        Require(errs, body, "customer_id", "int");
        if (!Bail())
        {
            Require(errs, body, "status", "string");
        }
        if (!Bail())
        {
            Require(errs, body, "lines", "array");
        }

        JsonElement? raw = Field(body, "lines");
        bool haveLines = raw is { ValueKind: JsonValueKind.Array };
        if (haveLines && !Bail())
        {
            JsonElement rows = raw!.Value;
            if (rows.GetArrayLength() == 0)
            {
                errs.Add(new FieldError("lines", "min_length"));
            }
            int i = 0;
            foreach (JsonElement row in rows.EnumerateArray())
            {
                if (Bail())
                {
                    break;
                }
                JsonElement? pid = Field(row, "product_id");
                JsonElement? qty = Field(row, "qty");
                if (!IsInt(pid))
                {
                    errs.Add(new FieldError($"lines[{i}].product_id", "int"));
                }
                if (!Bail() && (!IsInt(qty) || qty!.Value.GetDouble() < 1))
                {
                    errs.Add(new FieldError($"lines[{i}].qty", "min"));
                }
                i++;
            }
        }
        if (errs.Count > 0)
        {
            throw new ValidationException(errs);
        }

        List<Line> lines = [];
        int total = 0;
        int index = 0;
        foreach (JsonElement row in raw!.Value.EnumerateArray())
        {
            int productId = (int)Field(row, "product_id")!.Value.GetDouble();
            int quantity = (int)Field(row, "qty")!.Value.GetDouble();
            int unit = _productById.TryGetValue(productId, out Product? p) ? p.PriceCents : 0;
            lines.Add(new Line(++index, productId, quantity, unit, unit * quantity));
            total += unit * quantity;
        }
        return new ValidatedOrder(null, (int)Field(body, "customer_id")!.Value.GetDouble(),
                                  Field(body, "status")!.Value.GetString()!, lines, total);
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
