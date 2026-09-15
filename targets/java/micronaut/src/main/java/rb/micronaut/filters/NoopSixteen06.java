package rb.micronaut.filters;

import io.micronaut.http.HttpRequest;
import io.micronaut.http.annotation.ServerFilter;
import io.micronaut.http.annotation.RequestFilter;

/** middleware: layer 7 of 16 on /middleware/sixteen. It runs and does nothing else. */
@ServerFilter("/middleware/sixteen")
public class NoopSixteen06 {

  @RequestFilter
  public void through(HttpRequest<?> request) { }
}
