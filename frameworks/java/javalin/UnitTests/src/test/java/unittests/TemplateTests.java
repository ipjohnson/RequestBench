package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.javalin.testtools.JavalinTest;
import io.javalin.testtools.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TemplateTests extends JavalinApp {

    // rb:test template.small,template.medium
    @ParameterizedTest
    @Tag("template.small")
    @Tag("template.medium")
    @ValueSource(strings = {"small", "medium"})
    void mustacheRendersThePayloadAsTheCorpusPage(String size) {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.get("/template/" + size);

            assertTrue(Answer.header(response, "content-type").startsWith("text/html"));
            assertEquals(Expected.normal(Expected.page("items." + size + ".json")), Expected.normal(response.body().string()));
        });
    }
}
