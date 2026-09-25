package unittests

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"reflect"
	"testing"
)

// rb:test compressed.gzip_small,compressed.gzip_large
func TestGzipIsAnsweredWhenTheRequestAsksForIt(t *testing.T) {
	for _, row := range []struct{ id, size string }{
		{"compressed.gzip_small", "small"},
		{"compressed.gzip_large", "large"},
	} {
		t.Run(row.id, func(t *testing.T) {
			before := serial(t, client(t).Get("/compressed/"+row.size, "Accept-Encoding: identity"))

			response := client(t).Get("/compressed/"+row.size, "Accept-Encoding: gzip", "Cache-Control: no-cache")

			assertStatus(t, response, http.StatusOK)
			assertHeader(t, response, "Content-Encoding", "gzip")
			reader, err := gzip.NewReader(bytes.NewReader(response.Body.Bytes()))
			if err != nil {
				t.Fatal(err)
			}
			plain, err := io.ReadAll(reader)
			if err != nil {
				t.Fatal(err)
			}
			if got, want := parsed(t, plain), payload(t, "items."+row.size+".json"); !reflect.DeepEqual(got, want) {
				t.Fatal("the gzipped body is not the payload")
			}
			if serial(t, response) <= before {
				t.Fatal("x-rb-serial did not advance")
			}
		})
	}
}

// rb:test compressed.identity_small,compressed.identity_large
func TestIdentityIsAnsweredUncompressed(t *testing.T) {
	for _, row := range []struct{ id, size string }{
		{"compressed.identity_small", "small"},
		{"compressed.identity_large", "large"},
	} {
		t.Run(row.id, func(t *testing.T) {
			response := client(t).Get("/compressed/"+row.size, "Accept-Encoding: identity", "Cache-Control: no-cache")

			assertNoHeader(t, response, "Content-Encoding")
			assertOK(t, payload(t, "items."+row.size+".json"), response)
		})
	}
}

func TestAWeightOfZeroRefusesGzip(t *testing.T) {
	response := client(t).Get("/compressed/small", "Accept-Encoding: gzip;q=0, identity")

	assertNoHeader(t, response, "Content-Encoding")
	assertOK(t, payload(t, "items.small.json"), response)
}

func TestEitherAnswerSaysItVariesByAcceptEncoding(t *testing.T) {
	for _, accept := range []string{"gzip", "identity"} {
		response := client(t).Get("/compressed/small", "Accept-Encoding: "+accept)

		assertHeader(t, response, "Vary", "Accept-Encoding")
	}
}
