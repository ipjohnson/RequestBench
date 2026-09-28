package unittests

import (
	"bytes"
	"net/http"
	"strconv"
	"strings"
	"testing"
)

// rb:test static.small,static.medium,static.large
func TestTheFileIsSentAsItIs(t *testing.T) {
	for _, row := range []struct{ id, file string }{
		{"static.small", "items.small.json"},
		{"static.medium", "items.medium.json"},
		{"static.large", "items.large.json"},
	} {
		t.Run(row.id, func(t *testing.T) {
			want := file(t, row.file)

			response := client(t).Get("/static/" + row.file)

			assertStatus(t, response, http.StatusOK)
			if kind := response.Header().Get("Content-Type"); !strings.HasPrefix(kind, "application/json") {
				t.Fatalf("content type %q", kind)
			}
			assertHeader(t, response, "Content-Length", strconv.Itoa(len(want)))
			if response.Header().Get("Last-Modified") == "" {
				t.Fatal("no last-modified")
			}
			if !bytes.Equal(response.Body.Bytes(), want) {
				t.Fatal("the body is not the file")
			}
		})
	}
}

func TestAFileThatIsNotThereIs404(t *testing.T) {
	assertStatus(t, client(t).Get("/static/nothing.json"), http.StatusNotFound)
}
