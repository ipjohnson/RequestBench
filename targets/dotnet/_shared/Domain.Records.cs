namespace RequestBench.Domain;

/// <summary>
/// domain: DomainFilter, DomainJoin and DomainAggregate do the work the spec pins. The gate
/// compares values, and a precomputed page produces the same value as a computed one, so
/// this is the one family where two conforming implementations can do wildly different
/// amounts of work. The predicate runs over the live list on every request, the join walks
/// the lines, and the aggregate folds every matching order. No index, no memoization.
/// </summary>
public sealed partial class DomainModel
{
    public Order GetOrder(string oid) =>
        int.TryParse(oid, out int id) && _orderById.TryGetValue(id, out Order? o)
            ? o : throw NotFoundException.Instance;

    public Line GetOrderLine(string oid, string lid)
    {
        Order order = GetOrder(oid);
        if (!int.TryParse(lid, out int id))
        {
            throw NotFoundException.Instance;
        }
        foreach (Line line in order.Lines)
        {
            if (line.Id == id)
            {
                return line;
            }
        }
        throw NotFoundException.Instance;
    }

    /// <summary>
    /// The page, the size and the status arrive already bound, because binding them is the
    /// framework's own job and lives in the target.
    /// </summary>
    public OrdersPage DomainFilter(int page, int size, string status)
    {
        page = Math.Max(0, page);
        // A size of zero means the default, not one. Every other language reaches that
        // through `size || 25`, where an explicit 0 is as absent as a missing parameter.
        size = Math.Min(100, Math.Max(1, size == 0 ? 25 : size));

        List<Order> rows = [];
        foreach (Order o in Orders)
        {
            if (o.Status == status)
            {
                rows.Add(o);
            }
        }
        int start = Math.Min(page * size, rows.Count);
        int count = Math.Min(size, rows.Count - start);
        return new OrdersPage(page, size, rows.Count, rows.GetRange(start, count));
    }

    public JoinSummary DomainJoin(string cid)
    {
        if (!int.TryParse(cid, out int id) || !_customerById.TryGetValue(id, out Customer? c))
        {
            throw NotFoundException.Instance;
        }
        int orderCount = 0, lifetime = 0, lineCount = 0, units = 0;
        List<RecentOrder> recent = [];
        foreach (Order o in Orders)
        {
            if (o.CustomerId != c.Id)
            {
                continue;
            }
            orderCount++;
            lifetime += o.TotalCents;
            foreach (Line line in o.Lines)
            {
                lineCount++;
                units += line.Qty;
            }
            recent.Add(new RecentOrder(o.Id, o.Created, o.TotalCents));
        }
        if (recent.Count > 5)
        {
            recent.RemoveRange(0, recent.Count - 5);
        }
        return new JoinSummary(c, orderCount, lifetime, lineCount, units, recent);
    }

    public Report DomainAggregate(string region)
    {
        HashSet<int> inRegion = [];
        foreach (Customer c in Customers)
        {
            if (c.Region == region)
            {
                inRegion.Add(c.Id);
            }
        }
        if (inRegion.Count == 0)
        {
            throw NotFoundException.Instance;
        }
        int orders = 0, revenue = 0;
        List<Order> matched = [];
        foreach (Order o in Orders)
        {
            if (!inRegion.Contains(o.CustomerId))
            {
                continue;
            }
            orders++;
            revenue += o.TotalCents;
            matched.Add(o);
        }
        // Highest first, ties broken by the lower id. Every other language sorts the same
        // way; a different tiebreak is a test failure rather than a preference.
        matched.Sort((a, b) => b.TotalCents != a.TotalCents
            ? b.TotalCents.CompareTo(a.TotalCents)
            : a.Id.CompareTo(b.Id));
        List<TopOrder> top = [];
        foreach (Order o in matched.Take(10))
        {
            top.Add(new TopOrder(o.Id, o.TotalCents));
        }
        return new Report(region, inRegion.Count, orders, revenue, top);
    }
}
