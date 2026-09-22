package implementation.routes;

import implementation.Echoed;
import implementation.Payloads;
import implementation.Search;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * forms: bodies bound through Spring MVC's form support. Tomcat parses both bodies into request
 * parameters, the urlencoded form binds to query.many's record exactly as the query string does,
 * and the multipart upload's file part arrives as a MultipartFile.
 */
@RestController
public class FormsRoutes {

    public record UploadedFile(String name, long bytes) {}

    public record UploadEcho(String tenant, String requestId) {}

    public record Uploaded(UploadedFile file, UploadEcho echo) {}

    private final Payloads p;

    FormsRoutes(Payloads p) {
        this.p = p;
    }

    @PostMapping("/forms/urlencoded")
    public Echoed<Search> urlencoded(Search search) {
        return Echoed.of(p.small(), search);
    }

    @PostMapping("/forms/multipart")
    public Uploaded multipart(@RequestParam String tenant, @RequestParam String requestId, @RequestParam MultipartFile file) {
        return new Uploaded(new UploadedFile(file.getOriginalFilename(), file.getSize()), new UploadEcho(tenant, requestId));
    }
}
