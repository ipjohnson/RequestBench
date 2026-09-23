package unittests;

import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@QuarkusTest
class FormsTests {

    // rb:test forms.urlencoded
    @Test
    @Tag("forms.urlencoded")
    void aUrlencodedFormBindsWhatTheQueryStringBinds() {
        Answer.is(Expected.withEcho("items.small.json", QueryTests.searchEcho()),
            Http.request().formParams(QueryTests.SEARCH).post("/forms/urlencoded"));
    }

    // rb:test forms.multipart
    @Test
    @Tag("forms.multipart")
    void aMultipartUploadBindsTwoFieldsAndTheWholeFile() {
        byte[] file = Expected.bytes("forms.file.txt");

        ObjectNode uploaded = Expected.JSON.createObjectNode();
        uploaded.putObject("file").put("name", "forms.file.txt").put("bytes", file.length);
        uploaded.putObject("echo").put("tenant", "qwertyuiopas").put("requestId", "0123456789abcdef");
        Answer.is(uploaded, Http.request()
            .multiPart("tenant", "qwertyuiopas")
            .multiPart("requestId", "0123456789abcdef")
            .multiPart("file", "forms.file.txt", file, "text/plain")
            .post("/forms/multipart"));
    }
}
