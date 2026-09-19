package rb.micronaut;

import io.micronaut.runtime.Micronaut;
import io.micronaut.serde.annotation.SerdeImport;
import rb.domain.Domain;
import rb.domain.Model;
import rb.hosts.Hosts;

/**
 * RequestBench target: Micronaut. Framework wiring only; behaviour from rb-shared.
 *
 * One controller per endpoint family, under routes/. Micronaut finds them at compile time
 * from this package, so nothing here lists them.
 *
 * The imports are the shared records Micronaut Serialization writes. rb-shared is compiled
 * without Micronaut's processor, so a record it defines can be written only once it is
 * imported here, including one that appears only as an echo.
 */
@SerdeImport(Model.PayloadBody.class)
@SerdeImport(Model.Product.class)
@SerdeImport(Model.PayloadWithEcho.class)
@SerdeImport(Model.QueryOne.class)
@SerdeImport(Model.QueryMany.class)
@SerdeImport(Model.OrdersPage.class)
@SerdeImport(Model.Order.class)
@SerdeImport(Model.Line.class)
@SerdeImport(Model.ValidatedOrder.class)
@SerdeImport(Model.ValidatedOrderWithId.class)
@SerdeImport(Model.JoinSummary.class)
@SerdeImport(Model.Customer.class)
@SerdeImport(Model.RecentOrder.class)
@SerdeImport(Model.Report.class)
@SerdeImport(Model.TopOrder.class)
@SerdeImport(Model.BindResult.class)
public class Main {

  /** Micronaut Serialization's version is the one the platform BOM manages. */
  public static final String SERIALIZER =
      "micronaut-serde-jackson from micronaut-platform " + Hosts.version("micronaut");

  public static void main(String[] args) throws Exception {
    Domain.load(Hosts.fixture());
    // PORT rather than MICRONAUT_SERVER_PORT, because every target reads the same variable.
    System.setProperty("micronaut.server.port", String.valueOf(Hosts.port()));
    Hosts.serializer(SERIALIZER);
    Micronaut.run(Main.class, args);
    Hosts.listening();
  }
}
