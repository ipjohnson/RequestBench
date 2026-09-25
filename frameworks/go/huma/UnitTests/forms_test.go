package unittests

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"strings"
	"testing"
)

// rb:test forms.urlencoded
func TestAFormIsBoundAsTheQueryIs(t *testing.T) {
	t.Run("forms.urlencoded", func(t *testing.T) {
		form := url.Values{}
		for name, value := range map[string]string{
			"page": "417", "size": "38", "status": "paid", "category": "garden",
			"sort": "created", "q": "alpha bravo", "minPrice": "1200", "maxPrice": "34000",
		} {
			form.Set(name, value)
		}

		response := client(t).Post("/forms/urlencoded", strings.NewReader(form.Encode()), "Content-Type: application/x-www-form-urlencoded")

		assertOK(t, withEcho(t, "items.small.json", search()), response)
	})
}

// rb:test forms.multipart
func TestAnUploadIsAnsweredWithItsNameAndLength(t *testing.T) {
	t.Run("forms.multipart", func(t *testing.T) {
		text := file(t, "forms.file.txt")
		var body bytes.Buffer
		parts := multipart.NewWriter(&body)
		_ = parts.WriteField("tenant", "qwertyuiopas")
		_ = parts.WriteField("requestId", "0123456789abcdef")
		// The corpus sends the file as text/plain, the type the form declares for it.
		upload, _ := parts.CreatePart(textproto.MIMEHeader{
			"Content-Disposition": {`form-data; name="file"; filename="forms.file.txt"`},
			"Content-Type":        {"text/plain"},
		})
		_, _ = upload.Write(text)
		_ = parts.Close()

		response := client(t).Post("/forms/multipart", &body, "Content-Type: "+parts.FormDataContentType())

		assertOK(t, map[string]any{
			"file": map[string]any{"name": "forms.file.txt", "bytes": float64(len(text))},
			"echo": map[string]any{"tenant": "qwertyuiopas", "requestId": "0123456789abcdef"},
		}, response)
	})
}

func TestAFormWithANumberThatIsNotOneIsRefused(t *testing.T) {
	response := client(t).Post("/forms/urlencoded", strings.NewReader("page=x"), "Content-Type: application/x-www-form-urlencoded")

	assertStatus(t, response, http.StatusUnprocessableEntity)
}
