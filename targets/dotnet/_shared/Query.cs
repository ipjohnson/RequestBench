namespace RequestBench.Domain;

/// <summary>
/// One query parameter, by name, as the framework parsed it.
///
/// The query family measures the framework parsing the query string, so the framework has
/// to do it; the domain only coerces what came back. A delegate is what keeps that split
/// honest without the domain knowing what an HttpRequest is.
/// </summary>
public delegate string? QueryLookup(string name);
