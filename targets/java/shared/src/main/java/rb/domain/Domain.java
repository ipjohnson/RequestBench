package rb.domain;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.zip.GZIPOutputStream;
import java.io.ByteArrayOutputStream;
import rb.domain.Errors.NotFound;
import rb.domain.Errors.Validation;
import rb.domain.Model.*;

/**
 * Behaviour shared by every Java target. Frameworks differ only in how they bind routes to
 * these methods, so the measured delta is framework overhead.
 *
 * A direct port of targets/go/_shared/domain.go and targets/node/_shared/domain.js. The
 * node reference is what every fingerprint is compared against, so where the three
 * could differ -- field order in a 422 body, an empty list versus a missing one, the
 * tiebreak in a sort -- this follows node.
 */
public final class Domain {
  private Domain() {}

  public static List<Product> products = List.of();
  public static List<Customer> customers = List.of();
  public static List<Order> orders = List.of();
  public static Map<String, List<Review>> reviews = Map.of();

  private static Map<Integer, Product> productById = Map.of();
  private static Map<Integer, Customer> customerById = Map.of();
  private static Map<Integer, Order> orderById = Map.of();
  private static Map<Integer, List<Order>> ordersByCustomer = Map.of();
  private static Map<String, List<Customer>> customersByRegion = Map.of();
  private static Map<String, PayloadDoc> payloads = Map.of();
  private static AuthDoc auth = new AuthDoc("", "");
  private static final AtomicLong serial = new AtomicLong();

  /**
   * The id a created order would get. The fixture holds 1..1000, so it is 1001: synthetic
   * and deterministic, which is all a Location header needs when nothing is persisted.
   */
  public static int nextOrderId;

  // The fixture also carries "seed", and may grow more. Go's struct and node's plain
  // parse both ignore what they do not name, so this does too.
  @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
  private record Fixture(List<Product> products, List<Customer> customers,
                         List<Order> orders, Map<String, List<Review>> reviews,
                         Map<String, PayloadDoc> payloads, AuthDoc auth) {}

  public static void load(String path) throws IOException {
    Fixture f = Json.MAPPER.readValue(Files.readAllBytes(Path.of(path)), Fixture.class);
    products = f.products();
    customers = f.customers();
    orders = f.orders();
    reviews = f.reviews();

    Map<Integer, Product> byProduct = new HashMap<>(products.size() * 2);
    for (Product p : products) {
      byProduct.put(p.id(), p);
    }
    productById = byProduct;

    Map<Integer, Customer> byCustomer = new HashMap<>(customers.size() * 2);
    // Insertion order decides by_region, which is then sorted by name, and decides the
    // order of a region's customers, which is not. A LinkedHashMap keeps it fixture order.
    Map<String, List<Customer>> byRegion = new LinkedHashMap<>();
    for (Customer c : customers) {
      byCustomer.put(c.id(), c);
      byRegion.computeIfAbsent(c.region(), r -> new ArrayList<>()).add(c);
    }
    customerById = byCustomer;
    customersByRegion = byRegion;

    nextOrderId = orders.size() + 1;
    Map<Integer, Order> byOrder = new HashMap<>(orders.size() * 2);
    Map<Integer, List<Order>> byCust = new HashMap<>(customers.size() * 2);
    for (Order o : orders) {
      byOrder.put(o.id(), o);
      byCust.computeIfAbsent(o.customerId(), k -> new ArrayList<>()).add(o);
    }
    orderById = byOrder;
    ordersByCustomer = byCust;

    payloads = f.payloads();
    auth = f.auth();
  }

  /** Node parses with Number(); a non-numeric id is simply not found. */
  private static int intOf(String s) {
    if (s == null || s.isEmpty()) {
      return Integer.MIN_VALUE;
    }
    try {
      return Integer.parseInt(s);
    } catch (NumberFormatException e) {
      return Integer.MIN_VALUE;
    }
  }

  private static <T> T found(T v) {
    if (v == null) {
      throw NotFound.INSTANCE;
    }
    return v;
  }

  public static Product getProduct(String id) {
    return found(productById.get(intOf(id)));
  }

  public static Customer getCustomer(String id) {
    return found(customerById.get(intOf(id)));
  }

  public static Order getOrder(String id) {
    return found(orderById.get(intOf(id)));
  }

  public static Map<String, String> jsonSmall() {
    return Map.of("message", "Hello, World!");
  }

  public static List<Line> getOrderLines(String oid) {
    return getOrder(oid).lines();
  }

  public static Line getOrderLine(String oid, String lid) {
    int n = intOf(lid);
    for (Line l : getOrder(oid).lines()) {
      if (l.id() == n) {
        return l;
      }
    }
    throw NotFound.INSTANCE;
  }

  public static List<Order> getCustomerOrders(String cid) {
    Customer c = getCustomer(cid);
    return ordersByCustomer.getOrDefault(c.id(), List.of());
  }

  public static Order getCustomerOrder(String cid, String oid) {
    Order o = getOrder(oid);
    if (o.customerId() != intOf(cid)) {
      throw NotFound.INSTANCE;
    }
    return o;
  }

  public static List<Review> getProductReviews(String pid) {
    Product p = getProduct(pid);
    return reviews.getOrDefault(String.valueOf(p.id()), List.of());
  }

  public static List<Customer> getRegionCustomers(String region) {
    return found(customersByRegion.get(region));
  }

  // ---- query families -------------------------------------------------------

  private static String qstr(Map<String, List<String>> q, String k) {
    List<String> v = q.get(k);
    return v == null || v.isEmpty() ? null : v.get(0);
  }

  /** Node's `int(x) || fallback`: anything unparseable, and zero, take the fallback. */
  private static int qint(Map<String, List<String>> q, String k, int fallback) {
    String s = qstr(q, k);
    if (s == null) {
      return fallback;
    }
    int n = intOf(s);
    return n == Integer.MIN_VALUE || n == 0 ? fallback : n;
  }

  private static <T> List<T> slice(List<T> rows, int from, int count) {
    int start = Math.min(Math.max(0, from), rows.size());
    int end = Math.min(start + count, rows.size());
    return rows.subList(start, end);
  }

  public static OrdersPage listOrders(Map<String, List<String>> q) {
    int page = Math.max(0, qint(q, "page", 0));
    // A size of zero means the default, not one. Every other language reaches that through
    // `size || 25`, where an explicit 0 is as absent as a missing parameter.
    int size = qint(q, "size", 25);
    size = Math.min(100, Math.max(1, size == 0 ? 25 : size));
    String status = qstr(q, "status");
    List<Order> rows = orders;
    if (status != null && !status.isEmpty()) {
      rows = new ArrayList<>(orders.size());
      for (Order o : orders) {
        if (o.status().equals(status)) {
          rows.add(o);
        }
      }
    }
    return new OrdersPage(page, size, rows.size(), slice(rows, page * size, size));
  }

  public static ProductsList listProducts(Map<String, List<String>> q) {
    String category = qstr(q, "category");
    String minRaw = qstr(q, "min_price");
    String maxRaw = qstr(q, "max_price");
    // long, because the open end of the range is MAX_VALUE and the comparison multiplies
    // by 100. The committed plan always sends both bounds, so this is correctness rather
    // than a fingerprint difference.
    long min = minRaw == null ? 0 : Math.max(0, intOf(minRaw) == Integer.MIN_VALUE ? 0 : intOf(minRaw));
    long max = maxRaw == null ? Long.MAX_VALUE / 100
                              : (intOf(maxRaw) == Integer.MIN_VALUE ? 0 : intOf(maxRaw));
    boolean priced = minRaw != null || maxRaw != null;
    List<Product> rows = new ArrayList<>(products.size());
    for (Product p : products) {
      if (category != null && !category.isEmpty() && !p.category().equals(category)) {
        continue;
      }
      if (priced && (p.priceCents() < min * 100 || p.priceCents() > max * 100)) {
        continue;
      }
      rows.add(p);
    }
    return new ProductsList(rows.size(), rows);
  }

  public static CustomersList listCustomers(Map<String, List<String>> q) {
    String term = qstr(q, "q");
    List<Customer> rows = new ArrayList<>(customers.size());
    for (Customer c : customers) {
      if (term == null || term.isEmpty() || c.name().contains(term) || c.email().contains(term)) {
        rows.add(c);
      }
    }
    boolean byCreated = "created".equals(qstr(q, "sort"));
    rows.sort(Comparator.comparing((Customer c) -> byCreated ? c.created() : c.name())
                        .thenComparingInt(Customer::id));
    int total = rows.size();
    return new CustomersList(total, byCreated ? "created" : "name", slice(rows, 0, 50));
  }

  public static SearchResult search(Map<String, List<String>> q) {
    int limit = Math.min(100, Math.max(1, qint(q, "limit", 25)));
    int offset = Math.max(0, qint(q, "offset", 0));
    String raw = qstr(q, "q");
    String term = raw == null ? "" : raw;
    List<Product> hits = new ArrayList<>(products.size());
    for (Product p : products) {
      if (p.name().contains(term)) {
        hits.add(p);
      }
    }
    boolean byPrice = "total".equals(qstr(q, "sort"));
    Comparator<Product> primary = byPrice
        ? Comparator.comparingInt(Product::priceCents)
        : Comparator.comparing(Product::name);
    if ("desc".equals(qstr(q, "dir"))) {
      primary = primary.reversed();
    }
    // The id tiebreak stays ascending even when the primary key is reversed, which is what
    // both the node and go references do.
    hits.sort(primary.thenComparingInt(Product::id));
    return new SearchResult(term, limit, offset, byPrice ? "price_cents" : "name",
                            hits.size(), slice(hits, offset, limit));
  }

  // ---- composition families -------------------------------------------------

  public static Summary customerSummary(String cid) {
    Customer c = getCustomer(cid);
    List<Order> os = ordersByCustomer.getOrDefault(c.id(), List.of());
    int lifetime = 0;
    Map<String, Integer> byStatus = new LinkedHashMap<>();
    for (Order o : os) {
      lifetime += o.totalCents();
      byStatus.merge(o.status(), 1, Integer::sum);
    }
    List<RecentOrder> recent = new ArrayList<>(5);
    for (Order o : slice(os, Math.max(0, os.size() - 5), 5)) {
      recent.add(new RecentOrder(o.id(), o.created(), o.totalCents()));
    }
    return new Summary(c, os.size(), lifetime, byStatus, recent);
  }

  public static FullOrder orderFull(String oid) {
    Order o = getOrder(oid);
    List<LineFull> lines = new ArrayList<>(o.lines().size());
    for (Line l : o.lines()) {
      lines.add(new LineFull(l.id(), l.productId(), l.qty(), l.unitCents(), l.totalCents(),
                             productById.get(l.productId())));
    }
    return new FullOrder(o.id(), o.customerId(), o.status(), o.created(), o.totalCents(),
                         lines, customerById.get(o.customerId()));
  }

  public static Report regionReport(String region) {
    List<Customer> cs = getRegionCustomers(region);
    List<Order> os = new ArrayList<>();
    for (Customer c : cs) {
      os.addAll(ordersByCustomer.getOrDefault(c.id(), List.of()));
    }
    int revenue = 0;
    for (Order o : os) {
      revenue += o.totalCents();
    }
    List<Order> sorted = new ArrayList<>(os);
    sorted.sort(Comparator.comparingInt(Order::totalCents).reversed()
                          .thenComparingInt(Order::id));
    List<TopOrder> top = new ArrayList<>(10);
    for (Order o : slice(sorted, 0, 10)) {
      top.add(new TopOrder(o.id(), o.totalCents()));
    }
    return new Report(region, cs.size(), os.size(), revenue, top);
  }

  public static Related relatedProducts(String pid) {
    Product p = getProduct(pid);
    List<Product> related = new ArrayList<>(10);
    for (Product x : products) {
      if (x.category().equals(p.category()) && x.id() != p.id() && related.size() < 10) {
        related.add(x);
      }
    }
    return new Related(p, related);
  }

  public static Board dashboard() {
    int revenue = 0;
    Map<String, Integer> byStatus = new LinkedHashMap<>();
    for (Order o : orders) {
      revenue += o.totalCents();
      byStatus.merge(o.status(), 1, Integer::sum);
    }
    List<RegionCount> byRegion = new ArrayList<>(customersByRegion.size());
    for (Map.Entry<String, List<Customer>> e : new TreeMap<>(customersByRegion).entrySet()) {
      byRegion.add(new RegionCount(e.getKey(), e.getValue().size()));
    }
    return new Board(products.size(), customers.size(), orders.size(), revenue,
                     byStatus, byRegion);
  }

  // ---- validation -----------------------------------------------------------
  // Error field order matches the node reference exactly; conform.py fingerprints the 422
  // bodies, so a reordered check here shows up as a conformance failure.

  /** Node's Number.isInteger: 1.0 counts, 1.5 does not. */
  private static boolean isInt(Object v) {
    if (!(v instanceof Number n)) {
      return false;
    }
    double d = n.doubleValue();
    return !Double.isNaN(d) && !Double.isInfinite(d) && d == Math.floor(d);
  }

  private static int intValue(Object v) {
    return ((Number) v).intValue();
  }

  /**
   * A parsed request body is a plain JDK Map, which is what go calls map[string]any and
   * node simply parses. Binding it to a Jackson tree type would tie the shared domain to
   * one Jackson major version, and the frameworks do not agree on one: Spring Boot 4 ships
   * Jackson 3 while Javalin, Vert.x and Helidon are on Jackson 2.
   */
  private static Object field(Map<String, Object> body, String name) {
    return body == null ? null : body.get(name);
  }

  private static void required(List<FieldError> errs, Map<String, Object> body, String field, String type) {
    Object v = field(body, field);
    if (v == null) {
      errs.add(new FieldError(field, "required"));
      return;
    }
    switch (type) {
      case "int" -> {
        if (!isInt(v)) {
          errs.add(new FieldError(field, "int"));
        }
      }
      case "string" -> {
        if (!(v instanceof String)) {
          errs.add(new FieldError(field, "string"));
        }
      }
      case "array" -> {
        if (!(v instanceof List)) {
          errs.add(new FieldError(field, "array"));
        }
      }
      default -> throw new IllegalArgumentException(type);
    }
  }

  private static int unitCents(int productId) {
    Product p = productById.get(productId);
    return p == null ? 0 : p.priceCents();
  }

  @SuppressWarnings("unchecked")
  private static Object lineField(Object line, String name) {
    return line instanceof Map<?, ?> m ? ((Map<String, Object>) m).get(name) : null;
  }

  public static ValidatedOrder validateOrder(Map<String, Object> body) {
    List<FieldError> errs = new ArrayList<>();
    required(errs, body, "customer_id", "int");
    required(errs, body, "status", "string");
    required(errs, body, "lines", "array");
    List<?> rawLines = field(body, "lines") instanceof List<?> l ? l : null;
    if (rawLines != null) {
      if (rawLines.isEmpty()) {
        errs.add(new FieldError("lines", "min_length"));
      }
      for (int i = 0; i < rawLines.size(); i++) {
        Object pid = lineField(rawLines.get(i), "product_id");
        Object qty = lineField(rawLines.get(i), "qty");
        if (!isInt(pid)) {
          errs.add(new FieldError("lines[" + i + "].product_id", "int"));
        }
        if (!isInt(qty) || intValue(qty) < 1) {
          errs.add(new FieldError("lines[" + i + "].qty", "min"));
        }
      }
    }
    if (!errs.isEmpty()) {
      throw new Validation(errs);
    }
    List<Line> lines = new ArrayList<>(rawLines.size());
    int total = 0;
    for (int i = 0; i < rawLines.size(); i++) {
      int pid = intValue(lineField(rawLines.get(i), "product_id"));
      int qty = intValue(lineField(rawLines.get(i), "qty"));
      int unit = unitCents(pid);
      lines.add(new Line(i + 1, pid, qty, unit, unit * qty));
      total += unit * qty;
    }
    return new ValidatedOrder(intValue(field(body, "customer_id")),
                              (String) field(body, "status"), lines, total);
  }

  public static ValidatedCustomer validateCustomer(Map<String, Object> body) {
    List<FieldError> errs = new ArrayList<>();
    required(errs, body, "name", "string");
    required(errs, body, "email", "string");
    required(errs, body, "region", "string");
    Object email = field(body, "email");
    if (email instanceof String s && !s.contains("@")) {
      errs.add(new FieldError("email", "format"));
    }
    if (!errs.isEmpty()) {
      throw new Validation(errs);
    }
    return new ValidatedCustomer(((String) field(body, "name")).trim(),
                                 ((String) email).toLowerCase(java.util.Locale.ROOT),
                                 (String) field(body, "region"));
  }

  public static ValidatedProduct validateProduct(Map<String, Object> body) {
    List<FieldError> errs = new ArrayList<>();
    required(errs, body, "name", "string");
    required(errs, body, "category", "string");
    required(errs, body, "price_cents", "int");
    Object price = field(body, "price_cents");
    if (isInt(price) && intValue(price) < 0) {
      errs.add(new FieldError("price_cents", "min"));
    }
    if (!errs.isEmpty()) {
      throw new Validation(errs);
    }
    return new ValidatedProduct((String) field(body, "name"),
                                (String) field(body, "category"), intValue(price));
  }

  public static Line validateLine(Map<String, Object> body) {
    List<FieldError> errs = new ArrayList<>();
    required(errs, body, "product_id", "int");
    required(errs, body, "qty", "int");
    if (!errs.isEmpty()) {
      throw new Validation(errs);
    }
    int pid = intValue(field(body, "product_id"));
    int qty = intValue(field(body, "qty"));
    int unit = unitCents(pid);
    return new Line(1, pid, qty, unit, unit * qty);
  }

  public static Customer patchCustomer(String cid, Map<String, Object> body) {
    Customer c = getCustomer(cid);
    // Node spreads the body over the customer only when the field is truthy, so an empty
    // string leaves the original in place.
    String newName = field(body, "name") instanceof String s && !s.isEmpty() ? s : c.name();
    String newRegion = field(body, "region") instanceof String s && !s.isEmpty()
        ? s : c.region();
    return new Customer(c.id(), newName, c.email(), newRegion, c.created());
  }

  public static EchoResult echo(Map<String, Object> body) {
    return new EchoResult(body, Json.bytes(body).length);
  }

  // ---- blend-v2 ---------------------------------------------------------------------
  //
  // The payload is the controlled variable: three fixed responses that every feature family
  // reuses unchanged, so subtracting a base endpoint from its arm leaves the feature and
  // nothing else.

  /**
   * Not pre-serialized. json.small against json.large is one fixture read, one serialize
   * and one write at three sizes; handing back a cached string would measure none of it.
   */
  public static PayloadBody payload(String size) {
    return payloads.get(size).body();
  }

  /**
   * Pinned in the fixture, so what a target spends is emitting the header and comparing it
   * rather than hashing a body.
   */
  public static String etagOf(String size) {
    return payloads.get(size).etag();
  }

  /**
   * Pinned across every language. Compression cost is dominated by codec and level, not by
   * framework, so an unpinned level makes compressed.* a zlib benchmark.
   */
  public static final int GZIP_LEVEL = 6;

  public static final String CACHEABLE = "public, max-age=60";

  /** Compresses at the pinned level, for targets whose framework brings no compressor. */
  public static byte[] gzip(byte[] raw) {
    ByteArrayOutputStream out = new ByteArrayOutputStream(raw.length / 2);
    try (GZIPOutputStream gz = new GZIPOutputStream(out) {
      {
        def.setLevel(GZIP_LEVEL);
      }
    }) {
      gz.write(raw);
    } catch (IOException e) {
      return raw;
    }
    return out.toByteArray();
  }

  /**
   * x-rb-serial, monotonic per process. A response served from a cache anywhere in the
   * path, or precomputed at boot, repeats a number it did not increment, and identical
   * bytes are the whole point of the fingerprint.
   */
  public static String nextSerial() {
    return Long.toString(serial.incrementAndGet());
  }

  /**
   * The denial arm's token differs only in its last character, so this compares the whole
   * string rather than failing on length. Crypto is not framework cost.
   */
  public static boolean tokenOk(String header) {
    return header != null && header.startsWith("Bearer ")
        && header.substring(7).equals(auth.token());
  }

  /**
   * The Location a created order points at. Built by concatenation rather than a format
   * string: "/domain/orders/%d" is indistinguishable from a route with a capture, and
   * harness/snippets.py then finds the domain routes in two places and refuses to guess.
   */
  public static String createdLocation() {
    return "/domain/orders/" + nextOrderId;
  }

  public static Map<String, String> notFoundBody() {
    return Map.of("error", "not_found");
  }

  public static Map<String, String> forbiddenBody() {
    return Map.of("error", "forbidden");
  }

  public static Map<String, Object> invalidBody(List<FieldError> errors) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("error", "validation_failed");
    out.put("errors", errors);
    return out;
  }

  // ---- query ---------------------------------------------------------------------------
  //
  // The framework parses the query string, which is the work the family measures; these
  // coerce what it parsed, so every target in the language answers the same values.

  public static QueryOne coerceOne(Map<String, List<String>> q) {
    return new QueryOne(qint(q, "page", 0));
  }

  public static QueryMany coerceMany(Map<String, List<String>> q) {
    return new QueryMany(qint(q, "page", 0), qint(q, "size", 0), qstr(q, "status"),
                         qstr(q, "category"), qstr(q, "sort"), qstr(q, "q"),
                         qint(q, "min_price", 0), qint(q, "max_price", 0));
  }

  // ---- body ----------------------------------------------------------------------------

  /**
   * Walks the parsed body. Without a field derived from the parsed structure a target can
   * pipe request bytes straight to the response and never parse, and the gate would not see
   * it: the comparison is over parsed values, so even a reordering is invisible.
   */
  public static int leafCount(Object v) {
    if (v instanceof Map<?, ?> m) {
      int n = 0;
      for (Object x : m.values()) {
        n += leafCount(x);
      }
      return n;
    }
    if (v instanceof List<?> l) {
      int n = 0;
      for (Object x : l) {
        n += leafCount(x);
      }
      return n;
    }
    return 1;
  }

  public static BindResult bindEcho(Map<String, Object> body) {
    return new BindResult(leafCount(body), Json.bytes(body).length, body);
  }

  /**
   * validateOrder reports every problem it finds; this stops at the first, which is what
   * body.rejected_all minus body.rejected_first states as a number: the same walk in the
   * same order, differing only in where it gives up.
   */
  public static ValidatedOrder validateOrderFirst(Map<String, Object> body) {
    List<FieldError> errs = new ArrayList<>();
    required(errs, body, "customer_id", "int");
    if (errs.isEmpty()) {
      required(errs, body, "status", "string");
    }
    if (errs.isEmpty()) {
      required(errs, body, "lines", "array");
    }
    List<?> rawLines = field(body, "lines") instanceof List<?> l ? l : null;
    if (errs.isEmpty() && rawLines != null) {
      if (rawLines.isEmpty()) {
        errs.add(new FieldError("lines", "min_length"));
      }
      for (int i = 0; i < rawLines.size() && errs.isEmpty(); i++) {
        Object pid = lineField(rawLines.get(i), "product_id");
        Object qty = lineField(rawLines.get(i), "qty");
        if (!isInt(pid)) {
          errs.add(new FieldError("lines[" + i + "].product_id", "int"));
        }
        if (errs.isEmpty() && (!isInt(qty) || intValue(qty) < 1)) {
          errs.add(new FieldError("lines[" + i + "].qty", "min"));
        }
      }
    }
    if (!errs.isEmpty()) {
      throw new Validation(errs);
    }
    return validateOrder(body);
  }

  // ---- domain ----------------------------------------------------------------------------
  //
  // domainFilter, domainJoin and domainAggregate do the work the spec pins. The gate compares
  // values, and a precomputed page produces the same value as a computed one, so this is the
  // one family where two conforming implementations can do wildly different amounts of work.
  // The predicate runs over the live list on every request, the join walks the lines, and the
  // aggregate folds every matching order. No index, no memoization.

  public static OrdersPage domainFilter(Map<String, List<String>> q) {
    int page = Math.max(0, qint(q, "page", 0));
    int size = Math.min(100, Math.max(1, qint(q, "size", 25)));
    String status = qstr(q, "status");
    List<Order> rows = new ArrayList<>();
    for (Order o : orders) {
      if (o.status().equals(status)) {
        rows.add(o);
      }
    }
    return new OrdersPage(page, size, rows.size(), slice(rows, page * size, size));
  }

  public static JoinSummary domainJoin(String cid) {
    Customer c = found(customerById.get(intOf(cid)));
    int orderCount = 0;
    int lifetime = 0;
    int lineCount = 0;
    int units = 0;
    List<RecentOrder> recent = new ArrayList<>();
    for (Order o : orders) {
      if (o.customerId() != c.id()) {
        continue;
      }
      orderCount++;
      lifetime += o.totalCents();
      for (Line l : o.lines()) {
        lineCount++;
        units += l.qty();
      }
      recent.add(new RecentOrder(o.id(), o.created(), o.totalCents()));
    }
    List<RecentOrder> last = recent.size() > 5
        ? new ArrayList<>(recent.subList(recent.size() - 5, recent.size()))
        : recent;
    return new JoinSummary(c, orderCount, lifetime, lineCount, units, last);
  }

  public static Report domainAggregate(String region) {
    List<Customer> inRegion = customersByRegion.get(region);
    if (inRegion == null || inRegion.isEmpty()) {
      throw NotFound.INSTANCE;
    }
    java.util.Set<Integer> ids = new java.util.HashSet<>(inRegion.size() * 2);
    for (Customer c : inRegion) {
      ids.add(c.id());
    }
    int count = 0;
    int revenue = 0;
    List<Order> matched = new ArrayList<>();
    for (Order o : orders) {
      if (!ids.contains(o.customerId())) {
        continue;
      }
      count++;
      revenue += o.totalCents();
      matched.add(o);
    }
    // Highest first, ties broken by the lower id, and stable so equal keys keep fixture
    // order. Every other language sorts the same way; a different tiebreak is a failure
    // rather than a preference.
    matched.sort(Comparator.comparingInt(Order::totalCents).reversed()
                           .thenComparingInt(Order::id));
    List<TopOrder> top = new ArrayList<>();
    for (Order o : matched.subList(0, Math.min(10, matched.size()))) {
      top.add(new TopOrder(o.id(), o.totalCents()));
    }
    return new Report(region, ids.size(), count, revenue, top);
  }
}
