package unittests

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"reflect"
	"testing"
)

// rb:test compressed.gzip_large
func TestGzipIsAnsweredWhenTheRequestAsksForIt(t *testing.T) {
	t.Run("compressed.gzip_large", func(t *testing.T) {
		before := serial(t, get(t, "/compressed/large", "Accept-Encoding", "identity"))

		response := get(t, "/compressed/large", "Accept-Encoding", "gzip", "Cache-Control", "no-cache")

		assertStatus(t, response, http.StatusOK)
		if coding := response.Header.Get("Content-Encoding"); coding != "gzip" {
			t.Fatalf("content encoding %q", coding)
		}
		reader, err := gzip.NewReader(bytes.NewReader(bodyOf(t, response)))
		if err != nil {
			t.Fatal(err)
		}
		plain, err := io.ReadAll(reader)
		if err != nil {
			t.Fatal(err)
		}
		if got, want := parsed(t, plain), payload(t, "items.large.json"); !reflect.DeepEqual(got, want) {
			t.Fatal("the gzipped body is not the payload")
		}
		if serial(t, response) <= before {
			t.Fatal("x-rb-serial did not advance")
		}
	})
}

// fasthttp compresses no body shorter than 200 bytes, and items.small is 123.
// rb:test compressed.gzip_small
func TestASmallBodyIsSentUncompressedWhenTheRequestAsksForGzip(t *testing.T) {
	t.Run("compressed.gzip_small", func(t *testing.T) {
		before := serial(t, get(t, "/compressed/small", "Accept-Encoding", "identity"))

		response := get(t, "/compressed/small", "Accept-Encoding", "gzip", "Cache-Control", "no-cache")

		if coding := response.Header.Get("Content-Encoding"); coding != "" {
			t.Fatalf("content encoding %q", coding)
		}
		assertHeader(t, response, "Vary", "Accept-Encoding")
		assertOK(t, payload(t, "items.small.json"), response)
		if serial(t, response) <= before {
			t.Fatal("x-rb-serial did not advance")
		}
	})
}

// rb:test compressed.identity_small,compressed.identity_large
func TestIdentityIsAnsweredUncompressed(t *testing.T) {
	for _, row := range []struct{ id, size string }{
		{"compressed.identity_small", "small"},
		{"compressed.identity_large", "large"},
	} {
		t.Run(row.id, func(t *testing.T) {
			response := get(t, "/compressed/"+row.size, "Accept-Encoding", "identity", "Cache-Control", "no-cache")

			if coding := response.Header.Get("Content-Encoding"); coding != "" {
				t.Fatalf("content encoding %q", coding)
			}
			assertOK(t, payload(t, "items."+row.size+".json"), response)
		})
	}
}
