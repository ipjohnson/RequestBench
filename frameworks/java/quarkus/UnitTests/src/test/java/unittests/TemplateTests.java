package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static unittests.Http.get;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
class TemplateTests {

    // rb:test template.small,template.medium,template.large
    @ParameterizedTest
    @Tag("template.small")
    @Tag("template.medium")
    @Tag("template.large")
    @ValueSource(strings = {"small", "medium", "large"})
    void quteRendersThePayloadAsTheCorpusPage(String size) {
        Response response = get("/template/" + size);

        assertTrue(response.contentType().startsWith("text/html"));
        assertEquals(Expected.normal(Expected.page("items." + size + ".json")), Expected.normal(response.asString()));
    }
}
