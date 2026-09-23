package unittests;

import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class FormsTests extends HelidonApp {

    // rb:test forms.urlencoded
    @Test
    @Tag("forms.urlencoded")
    void aUrlencodedFormBindsWhatTheQueryStringBinds() throws Exception {
        String form = QueryTests.SEARCH.entrySet().stream()
            .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
            .collect(Collectors.joining("&"));

        HttpResponse<byte[]> response = send("POST", "/forms/urlencoded", "application/x-www-form-urlencoded", form.getBytes(StandardCharsets.UTF_8));

        Answer.is(Expected.withEcho("items.small.json", QueryTests.searchEcho()), response);
    }

    // rb:test forms.multipart
    @Test
    @Tag("forms.multipart")
    void aMultipartUploadBindsTwoFieldsAndTheWholeFile() throws Exception {
        byte[] file = Expected.bytes("forms.file.txt");
        String boundary = "rb-7c4f1e0a9d";
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        for (Map.Entry<String, String> field : Map.of("tenant", "qwertyuiopas", "requestId", "0123456789abcdef").entrySet()) {
            body.writeBytes(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + field.getKey() + "\"\r\n\r\n"
                + field.getValue() + "\r\n").getBytes(StandardCharsets.UTF_8));
        }
        body.writeBytes(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"forms.file.txt\"\r\n"
            + "Content-Type: text/plain\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        body.writeBytes(file);
        body.writeBytes(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));

        HttpResponse<byte[]> response = send("POST", "/forms/multipart", "multipart/form-data; boundary=" + boundary, body.toByteArray());

        ObjectNode uploaded = Expected.JSON.createObjectNode();
        uploaded.putObject("file").put("name", "forms.file.txt").put("bytes", file.length);
        uploaded.putObject("echo").put("tenant", "qwertyuiopas").put("requestId", "0123456789abcdef");
        Answer.is(uploaded, response);
    }
}
