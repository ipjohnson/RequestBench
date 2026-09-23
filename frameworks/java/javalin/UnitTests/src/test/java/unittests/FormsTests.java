package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import com.fasterxml.jackson.databind.node.ObjectNode;
import io.javalin.testtools.FormBody;
import io.javalin.testtools.JavalinTest;
import io.javalin.testtools.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class FormsTests extends JavalinApp {

    // rb:test forms.urlencoded
    @Test
    @Tag("forms.urlencoded")
    void aUrlencodedFormIsReadAsTheQueryStringIs() {
        FormBody.Builder form = new FormBody.Builder();
        QueryTests.SEARCH.forEach(form::add);

        JavalinTest.test(app(), (server, client) -> {
            Response response = client.request("/forms/urlencoded", request -> request.post(form.build()));

            Answer.is(Expected.withEcho("items.small.json", QueryTests.searchEcho()), response);
        });
    }

    // rb:test forms.multipart
    @Test
    @Tag("forms.multipart")
    void aMultipartUploadIsReadWithItsTwoFieldsAndTheWholeFile() {
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

        ObjectNode uploaded = Expected.JSON.createObjectNode();
        uploaded.putObject("file").put("name", "forms.file.txt").put("bytes", file.length);
        uploaded.putObject("echo").put("tenant", "qwertyuiopas").put("requestId", "0123456789abcdef");
        JavalinTest.test(app(), (server, client) -> {
            HttpResponse<byte[]> response = send(request(client, "/forms/multipart", "content-type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())));

            assertEquals(uploaded, Expected.JSON.readTree(response.body()));
        });
    }
}
