package rb.micronaut.filters;

import io.micronaut.http.HttpRequest;
import io.micronaut.http.annotation.ServerFilter;
import io.micronaut.http.annotation.RequestFilter;

/** middleware: layer 2 of 4 on /middleware/four. It runs and does nothing else. */
@ServerFilter("/middleware/four")
public class NoopFour01 {

  @RequestFilter
  public void through(HttpRequest<?> request) { }
}
