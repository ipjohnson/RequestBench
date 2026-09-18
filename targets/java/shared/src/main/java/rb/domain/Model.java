package rb.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import java.util.List;
import java.util.Map;

/**
 * The response shapes, mirroring the structs in targets/go/_shared/domain.go.
 *
 * Field names are the wire names. conform.py canonicalises JSON with sorted keys before
 * fingerprinting, so declaration order does not affect the comparison, but the names and
 * the types do.
 */
public final class Model {
  private Model() {}

  public record Product(int id, String name, String category,
                        @JsonProperty("price_cents") int priceCents,
                        @JsonProperty("in_stock") boolean inStock) {}

  public record Review(int id, @JsonProperty("product_id") int productId,
                       int stars, String body) {}

  public record Customer(int id, String name, String email, String region, String created) {}

  public record Line(int id, @JsonProperty("product_id") int productId, int qty,
                     @JsonProperty("unit_cents") int unitCents,
                     @JsonProperty("total_cents") int totalCents) {}

  public record Order(int id, @JsonProperty("customer_id") int customerId, String status,
                      String created, @JsonProperty("total_cents") int totalCents,
                      List<Line> lines) {}

  // ---- query families -----------------------------------------------------

  public record OrdersPage(int page, int size, int total, List<Order> items) {}

  public record ProductsList(int total, List<Product> items) {}

  public record CustomersList(int total, String sort, List<Customer> items) {}

  public record SearchResult(String term, int limit, int offset, String sort,
                             int total, List<Product> items) {}

  // ---- composition families -----------------------------------------------

  public record RecentOrder(int id, String created,
                            @JsonProperty("total_cents") int totalCents) {}

  @JsonPropertyOrder({"customer", "order_count", "lifetime_cents", "by_status", "recent"})
  public record Summary(Customer customer,
                        @JsonProperty("order_count") int orderCount,
                        @JsonProperty("lifetime_cents") int lifetimeCents,
                        @JsonProperty("by_status") Map<String, Integer> byStatus,
                        List<RecentOrder> recent) {}

  public record LineFull(int id, @JsonProperty("product_id") int productId, int qty,
                         @JsonProperty("unit_cents") int unitCents,
                         @JsonProperty("total_cents") int totalCents,
                         Product product) {}

  public record FullOrder(int id, @JsonProperty("customer_id") int customerId, String status,
                          String created, @JsonProperty("total_cents") int totalCents,
                          List<LineFull> lines, Customer customer) {}

  public record TopOrder(int id, @JsonProperty("total_cents") int totalCents) {}

  public record Report(String region, int customers, int orders,
                       @JsonProperty("revenue_cents") int revenueCents,
                       List<TopOrder> top) {}

  public record Related(Product product, List<Product> related) {}

  public record RegionCount(String region, int customers) {}

  public record Board(int products, int customers, int orders,
                      @JsonProperty("revenue_cents") int revenueCents,
                      @JsonProperty("by_status") Map<String, Integer> byStatus,
                      @JsonProperty("by_region") List<RegionCount> byRegion) {}

  // ---- validation ---------------------------------------------------------

  /**
   * The response json.*, compressed.*, etag.*, cache.* and template.* all serve. It is the
   * controlled variable: three fixed bodies that every feature family reuses unchanged, so
   * subtracting a base endpoint from its arm leaves the feature and nothing else.
   */
  public record PayloadBody(int count, List<Product> items, String size) {}

  /**
   * The payload with an echo beside it. PayloadBody's fields are repeated rather than nested,
   * so the JSON is the payload's own keys plus echo. The echo is whatever the handler bound,
   * as a record or a map of its own.
   */
  public record PayloadWithEcho(int count, List<Product> items, String size, Object echo) {}

  // The fixture carries bytes and html alongside the body, for the generator and for the
  // template comparison. A target needs neither, and Jackson refuses an undeclared field
  // unless it is told not to.
  @JsonIgnoreProperties(ignoreUnknown = true)
  public record PayloadDoc(PayloadBody body) {}

  /**
   * What every target sizes its response cache against: the distinct keys the plan sends, a
   * capacity with room above them, an expiry past the end of a run, and the header values
   * the vary rows carry. Derived and asserted in harness/make_fixture.py rather than chosen
   * per target, because a store smaller than the key count evicts inside the measured
   * window and the family would report eviction policy instead of the feature.
   */
  @JsonIgnoreProperties(ignoreUnknown = true)
  public record CacheDoc(int capacity, int keys,
                         @JsonProperty("ttl_s") int ttlSeconds,
                         Map<String, Map<String, List<String>>> vary) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record AuthDoc(String token, @JsonProperty("wrong_token") String wrongToken) {}

  public record QueryOne(int page) {}

  public record QueryMany(int page, int size, String status, String category, String sort,
                          String q,
                          @JsonProperty("min_price") int minPrice,
                          @JsonProperty("max_price") int maxPrice) {}

  public record BindResult(int fields, int bytes, Object echo) {}

  public record JoinSummary(Customer customer,
                            @JsonProperty("order_count") int orderCount,
                            @JsonProperty("lifetime_cents") int lifetimeCents,
                            @JsonProperty("line_count") int lineCount,
                            int units, List<RecentOrder> recent) {}

  /**
   * One order line as it arrived, before pricing. What a framework's own validator hands
   * back once it has said the body is good, whatever shape it validated.
   */
  public record LineInput(int productId, int qty) {}

  public record ValidatedOrder(@JsonProperty("customer_id") int customerId, String status,
                               List<Line> lines,
                               @JsonProperty("total_cents") int totalCents) {}

  @JsonPropertyOrder({"id", "customer_id", "status", "lines", "total_cents"})
  public record ValidatedOrderWithId(int id, @JsonProperty("customer_id") int customerId,
                                     String status, List<Line> lines,
                                     @JsonProperty("total_cents") int totalCents) {}

  public record ValidatedCustomer(String name, String email, String region) {}

  public record ValidatedProduct(String name, String category,
                                 @JsonProperty("price_cents") int priceCents) {}

  public record EchoResult(Object received, int bytes) {}
}
