package rb.micronaut.filters;

import io.micronaut.http.HttpRequest;
import io.micronaut.http.annotation.ServerFilter;
import io.micronaut.http.annotation.RequestFilter;

/** middleware: layer 1 of 4 on /middleware/four. It runs and does nothing else. */
@ServerFilter("/middleware/four")
public class NoopFour00 {

  @RequestFilter
  public void through(HttpRequest<?> request) { }
}
