package unittests

import (
	"bytes"
	"net/http"
	"strconv"
	"strings"
	"testing"
)

// rb:test static.file
func TestTheFileIsSentAsItIs(t *testing.T) {
	t.Run("static.file", func(t *testing.T) {
		want := file(t, "items.large.json")

		response := get(t, "/static/items.large.json")

		assertStatus(t, response, http.StatusOK)
		if kind := response.Header.Get("Content-Type"); !strings.HasPrefix(kind, "application/json") {
			t.Fatalf("content type %q", kind)
		}
		assertHeader(t, response, "Content-Length", strconv.Itoa(len(want)))
		if response.Header.Get("Last-Modified") == "" {
			t.Fatal("no last-modified")
		}
		if !bytes.Equal(bodyOf(t, response), want) {
			t.Fatal("the body is not the file")
		}
	})
}

func TestAFileThatIsNotThereIs404(t *testing.T) {
	assertStatus(t, get(t, "/static/nothing.json"), http.StatusNotFound)
}
