package rb.spring;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import rb.domain.Domain;

// rb:test *
/**
 * The target, booted by @SpringBootTest and driven through MockMvc, which is where Spring
 * Boot's reference starts: "By default, @SpringBootTest does not start the server but instead
 * sets up a mock environment for testing web endpoints." No server and no socket; MockMvc
 * calls the DispatcherServlet with a mock request, so every filter and interceptor still runs.
 *
 * <p>The test starters are the ones Spring Initializr writes for a Boot 4.1 project with web,
 * validation and Thymeleaf: Boot 4 split the one spring-boot-starter-test into a test starter
 * per technology, and a project gets one for each starter it uses.
 *
 * <p>@SpringBootTest builds the application context and never calls main(), which is where
 * this target loads its fixture, so the suite loads it. That is work a test has to know to do.
 * MockHttpServletResponse holds the bytes the controller wrote, so nothing decodes a gzip body
 * before the floor sees it.
 */
@SpringBootTest
@AutoConfigureMockMvc
abstract class SpringSuite {
  static final String TARGET = "java:spring-boot";

  @Autowired MockMvc mvc;

  @BeforeAll
  static void loadTheFixtureMainWouldHaveLoaded() throws Exception {
    Domain.load(Planned.ROOT.resolve("spec").resolve("fixture.json").toString());
  }

  /** Send one of an endpoint's planned requests. */
  Floor.Answer send(Planned.Ask a) throws Exception {
    return send(a, a.headers());
  }

  Floor.Answer send(Planned.Ask a, Map<String, String> headers) throws Exception {
    MockHttpServletRequestBuilder req =
        MockMvcRequestBuilders.request(HttpMethod.valueOf(a.method()), URI.create(a.path()));
    headers.forEach(req::header);
    if (a.body() != null) {
      req.content(a.body());
    }
    MvcResult r = mvc.perform(req).andReturn();
    // A controller that returns a future has only started when perform() comes back.
    if (r.getRequest().isAsyncStarted()) {
      r = mvc.perform(asyncDispatch(r)).andReturn();
    }
    MockHttpServletResponse res = r.getResponse();
    Map<String, String> out = new LinkedHashMap<>();
    res.getHeaderNames().forEach(n -> out.put(n.toLowerCase(), res.getHeader(n)));
    return new Floor.Answer(res.getStatus(), out.getOrDefault("content-type", ""),
        out.getOrDefault("content-encoding", ""), res.getContentAsByteArray(), out);
  }

  /** Ask for the validator first, then send the request that carries it. */
  Floor.Answer sendAfterCapture(Planned.Ask a) throws Exception {
    String[] c = Planned.captureFor(a);
    MvcResult first = mvc.perform(
        MockMvcRequestBuilders.request(HttpMethod.valueOf(c[0]), URI.create(c[1]))).andReturn();
    String captured = first.getResponse().getHeader(c[2]);
    return send(a, Planned.resolved(a, captured == null ? "" : captured));
  }
}
// rb:end
