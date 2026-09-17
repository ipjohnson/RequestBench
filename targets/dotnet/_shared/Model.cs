using System.Text.Json;
using System.Text.Json.Serialization;

namespace RequestBench.Domain;

/// <summary>
/// The wire shapes every target serializes. Property names are PascalCase and the naming
/// policy in <see cref="Json"/> writes them as snake_case, so PriceCents and price_cents
/// are the same field and neither is spelled twice.
/// </summary>
public sealed record Product(int Id, string Name, string Category, int PriceCents, bool InStock);

public sealed record Customer(int Id, string Name, string Email, string Region, string Created);

public sealed record Line(int Id, int ProductId, int Qty, int UnitCents, int TotalCents);

public sealed record Order(int Id, int CustomerId, string Status, string Created,
                           int TotalCents, IReadOnlyList<Line> Lines);

/// <summary>
/// The response json.*, compressed.*, cached.* and template.* all serve. It is the
/// controlled variable: three fixed bodies that every feature family reuses unchanged, so
/// subtracting a base endpoint from its arm leaves the feature and nothing else.
/// </summary>
public sealed record PayloadBody(int Count, IReadOnlyList<Product> Items, string Size);

public sealed record PayloadDoc(PayloadBody Body);

/// <summary>
/// What every target sizes its response cache against: the distinct keys the plan sends,
/// a capacity with room above them, an expiry past the end of a run, and the header values
/// the vary rows carry. Derived and asserted in harness/make_fixture.py rather than chosen
/// per target, because a store smaller than the key count evicts inside the measured window.
/// </summary>
public sealed record CacheDoc(int Capacity, int Keys, int TtlS,
                              IReadOnlyDictionary<string, IReadOnlyDictionary<string, IReadOnlyList<string>>> Vary);

public sealed record AuthDoc(string Token, string WrongToken);

public sealed record FieldError(string Field, string Rule);

public sealed record QueryOne(int Page);

public sealed record QueryMany(int Page, int Size, string Status, string Category,
                               string Sort, string Q, int MinPrice, int MaxPrice);

public sealed record BindResult(int Fields, int Bytes, JsonElement Echo);

public sealed record RecentOrder(int Id, string Created, int TotalCents);

public sealed record TopOrder(int Id, int TotalCents);

public sealed record OrdersPage(int Page, int Size, int Total, IReadOnlyList<Order> Items);

public sealed record JoinSummary(Customer Customer, int OrderCount, int LifetimeCents,
                                 int LineCount, int Units, IReadOnlyList<RecentOrder> Recent);

public sealed record Report(string Region, int Customers, int Orders, int RevenueCents,
                            IReadOnlyList<TopOrder> Top);

/// <summary>
/// A validated order. Id is absent on a create and present on a replace, which is why it
/// is nullable and dropped when null rather than written as 0.
/// </summary>
public sealed record ValidatedOrder(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Id,
    int CustomerId, string Status, IReadOnlyList<Line> Lines, int TotalCents);

/// <summary>The fixture as it sits on disk.</summary>
public sealed record Fixture(IReadOnlyList<Product> Products, IReadOnlyList<Customer> Customers,
                             IReadOnlyList<Order> Orders,
                             IReadOnlyDictionary<string, PayloadDoc> Payloads, AuthDoc Auth,
                             CacheDoc Cache);
