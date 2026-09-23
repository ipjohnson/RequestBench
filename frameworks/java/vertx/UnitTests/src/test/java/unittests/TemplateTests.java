package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpResponse;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TemplateTests extends VertxApp {

    // rb:test template.small,template.medium
    @ParameterizedTest
    @Tag("template.small")
    @Tag("template.medium")
    @ValueSource(strings = {"small", "medium"})
    void handlebarsRendersThePayloadAsTheCorpusPage(String size) throws Exception {
        HttpResponse<byte[]> response = get("/template/" + size);

        assertTrue(Answer.header(response, "content-type").startsWith("text/html"));
        assertEquals(Expected.normal(Expected.page("items." + size + ".json")), Expected.normal(Answer.text(response)));
    }
}
