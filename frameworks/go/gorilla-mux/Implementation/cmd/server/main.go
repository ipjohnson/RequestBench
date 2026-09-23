// The server: the payloads loaded from RB_PAYLOADS, then the router served on PORT.
package main

import (
	"cmp"
	"log"
	"net/http"
	"os"

	implementation "github.com/ipjohnson/RequestBench/frameworks/go/gorilla-mux/Implementation"
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
	log.Fatal(http.ListenAndServe("0.0.0.0:"+cmp.Or(os.Getenv("PORT"), "8080"), implementation.Router(payloads)))
}
