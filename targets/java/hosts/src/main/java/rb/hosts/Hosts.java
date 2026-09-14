package rb.hosts;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

/**
 * Which execution host a target is running under, and what sits between the host and the
 * framework.
 *
 * The Java equivalent of targets/go/_hosts/serve.go, minus the Serve method: Go has one
 * http.Handler interface every target satisfies, and Java has no common type across
 * Javalin, Vert.x, Helidon, Spring, Micronaut and Quarkus. Each target therefore starts
 * itself and asks here which host it is under; what is shared is the host name, the port,
 * the adapter record and the /__meta shape.
 */
public final class Hosts {
  private Hosts() {}

  public static final String CONTAINER = "container";
  public static final String GCP_FUNC = "gcp-func";
  public static final String LAMBDA_RIE = "lambda-rie";

  private static final Properties VERSIONS = new Properties();

  static {
    try (InputStream in = Hosts.class.getResourceAsStream("/rb-versions.properties")) {
      if (in != null) {
        VERSIONS.load(in);
      }
    } catch (IOException e) {
      // A missing version file must not stop a target booting; /__meta reports "" and the
      // run records an unknown version rather than failing the measurement.
    }
  }

  /**
   * What the parent pom pins for a dependency. This is the declared version, which for
   * every framework here is also the resolved one -- the poms use exact versions, never
   * ranges. Micronaut is the one to read carefully: its pin is the platform BOM version,
   * which is what a user declares, and its core artifacts carry their own line.
   */
  public static String version(String key) {
    return VERSIONS.getProperty(key, "");
  }

  /**
   * What sits between the host and the framework, filled in by whichever host started.
   *
   * A host adapter can move a target's numbers with the framework version unchanged, and
   * then nothing recorded explains the step. It is empty under container, where the
   * framework serves its own requests.
   */
  private static final List<String> ADAPTERS = new ArrayList<>(2);

  /** Name an adapter and the version it was pinned at, as "name version". */
  public static void adapter(String name, String versionKey) {
    String v = version(versionKey);
    ADAPTERS.add(v.isEmpty() ? name : name + " " + v);
  }

  public static String host() {
    String h = System.getenv("RB_HOST");
    return h == null || h.isEmpty() ? CONTAINER : h;
  }

  public static int port() {
    String p = System.getenv("PORT");
    return p == null || p.isEmpty() ? 8080 : Integer.parseInt(p);
  }

  /** Where the shared fixture is. The Lambda base image puts the task somewhere else. */
  public static String fixture() {
    String f = System.getenv("RB_FIXTURE");
    return f == null || f.isEmpty() ? "../../spec/fixture.json" : f;
  }

  /**
   * The JSON library a target actually serializes with.
   *
   * Java frameworks do not agree on one: Spring Boot 4 ships Jackson 3 while Javalin,
   * Vert.x and Helidon are on Jackson 2. That moves a target's numbers with the framework
   * version unchanged, which is the same reason the adapter is recorded, so it is recorded
   * rather than left to whoever reads the pom.
   */
  private static String serializer = "jackson " + VERSIONS.getProperty("jackson", "");

  public static void serializer(String name) {
    serializer = name;
  }

  /** What a target answers on /__meta. */
  public static Map<String, String> meta(String framework, String version) {
    Map<String, String> m = new LinkedHashMap<>(5);
    m.put("framework", framework);
    m.put("version", version);
    m.put("runtime", runtime());
    m.put("adapter", String.join(" + ", ADAPTERS));
    m.put("serializer", serializer);
    return m;
  }

  public static String runtime() {
    return "java " + System.getProperty("java.version");
  }
}
