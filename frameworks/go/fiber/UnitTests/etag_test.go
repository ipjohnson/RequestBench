package unittests

import (
	"hash/crc32"
	"io"
	"net/http"
	"reflect"
	"strconv"
	"testing"
)

// koopman is the CRC-32 table Fiber's etag middleware checksums a body with.
var koopman = crc32.MakeTable(0xD5828281)

// rb:test etag.small,etag.large
func TestTheTagIsTheBodysLengthAndChecksum(t *testing.T) {
	for _, row := range []struct{ id, size string }{
		{"etag.small", "small"},
		{"etag.large", "large"},
	} {
		t.Run(row.id, func(t *testing.T) {
			before := serial(t, get(t, "/etag/"+row.size))

			response := get(t, "/etag/"+row.size)
			body := bodyOf(t, response)

			tag := `"` + strconv.Itoa(len(body)) + "-" + strconv.FormatUint(uint64(crc32.Checksum(body, koopman)), 10) + `"`
			assertHeader(t, response, "ETag", tag)
			assertStatus(t, response, http.StatusOK)
			if !equalJSON(t, body, payload(t, "items."+row.size+".json")) {
				t.Fatal("the body is not the payload")
			}
			if serial(t, response) <= before {
				t.Fatal("x-rb-serial did not advance")
			}
		})
	}
}

// rb:test etag.match_large
func TestAMatchingTagIsAnswered304WithNoBody(t *testing.T) {
	t.Run("etag.match_large", func(t *testing.T) {
		tag := get(t, "/etag/large").Header.Get("ETag")

		response := get(t, "/etag/large", "If-None-Match", tag)

		assertStatus(t, response, http.StatusNotModified)
		if body, _ := io.ReadAll(response.Body); len(body) != 0 {
			t.Fatalf("a 304 with %d bytes", len(body))
		}
		assertHeader(t, response, "ETag", tag)
	})
}

// rb:test etag.stale_large
func TestAStaleTagIsAnsweredInFull(t *testing.T) {
	t.Run("etag.stale_large", func(t *testing.T) {
		response := get(t, "/etag/large", "If-None-Match", `"0000000000000000"`)

		assertOK(t, payload(t, "items.large.json"), response)
	})
}

func TestAWeakTagInAListStillMatches(t *testing.T) {
	tag := get(t, "/etag/small").Header.Get("ETag")

	response := get(t, "/etag/small", "If-None-Match", `"other", W/`+tag)

	assertStatus(t, response, http.StatusNotModified)
}

func equalJSON(t *testing.T, raw []byte, want any) bool {
	t.Helper()
	got := parsed(t, raw)
	return reflect.DeepEqual(got, want)
}
