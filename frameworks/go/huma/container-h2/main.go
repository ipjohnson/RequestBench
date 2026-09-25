// The server: the payloads loaded from RB_PAYLOADS, then the ServeMux Huma registers its operations on,
// served on PORT over HTTP/2 with prior knowledge.
package main

import (
	"cmp"
	"log"
	"net/http"
	"os"

	implementation "github.com/ipjohnson/RequestBench/frameworks/go/huma/Implementation"
)

func main() {
	directory := os.Getenv("RB_PAYLOADS")
	if directory == "" {
		log.Fatal("RB_PAYLOADS has to name the payload directory")
	}
	payloads, err := implementation.Load(directory)
	if err != nil {
		log.Fatal(err)
	}
	mux, _ := implementation.New(payloads)
	// net/http answers HTTP/2 with prior knowledge on a server whose Protocols allow unencrypted HTTP/2.
	var protocols http.Protocols
	protocols.SetUnencryptedHTTP2(true)
	server := &http.Server{Addr: "0.0.0.0:" + cmp.Or(os.Getenv("PORT"), "8080"), Handler: mux, Protocols: &protocols}
	log.Fatal(server.ListenAndServe())
}
