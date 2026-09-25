package unittests

import (
	"crypto/sha1"
	"encoding/hex"
	"net/http"
	"reflect"
	"testing"
)

// rb:test etag.small,etag.large
func TestTheTagIsTheHashOfTheBody(t *testing.T) {
	for _, row := range []struct{ id, size string }{
		{"etag.small", "small"},
		{"etag.large", "large"},
	} {
		t.Run(row.id, func(t *testing.T) {
			before := serial(t, client(t).Get("/etag/"+row.size))

			response := client(t).Get("/etag/" + row.size)

			sum := sha1.Sum(response.Body.Bytes())
			assertHeader(t, response, "ETag", `"`+hex.EncodeToString(sum[:])+`"`)
			assertOK(t, payload(t, "items."+row.size+".json"), response)
			if serial(t, response) <= before {
				t.Fatal("x-rb-serial did not advance")
			}
		})
	}
}

// rb:test etag.match_large
func TestAMatchingTagIsAnswered304WithNoBody(t *testing.T) {
	t.Run("etag.match_large", func(t *testing.T) {
		tag := client(t).Get("/etag/large").Header().Get("ETag")

		response := client(t).Get("/etag/large", "If-None-Match: "+tag)

		assertStatus(t, response, http.StatusNotModified)
		if response.Body.Len() != 0 {
			t.Fatalf("a 304 with %d bytes", response.Body.Len())
		}
		assertHeader(t, response, "ETag", tag)
	})
}

// rb:test etag.stale_large
func TestAStaleTagIsAnsweredInFull(t *testing.T) {
	t.Run("etag.stale_large", func(t *testing.T) {
		response := client(t).Get("/etag/large", `If-None-Match: "0000000000000000"`)

		assertOK(t, payload(t, "items.large.json"), response)
	})
}

func TestAWeakTagMatches(t *testing.T) {
	tag := client(t).Get("/etag/small").Header().Get("ETag")

	response := client(t).Get("/etag/small", "If-None-Match: W/"+tag)

	assertStatus(t, response, http.StatusNotModified)
}

func TestTheHashIsOfTheBytesSent(t *testing.T) {
	response := client(t).Get("/etag/small")

	if !reflect.DeepEqual(parsed(t, response.Body.Bytes()), payload(t, "items.small.json")) {
		t.Fatal("the body is not the payload")
	}
}
