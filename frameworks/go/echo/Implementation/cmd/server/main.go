// The server: the payloads loaded from RB_PAYLOADS, then the router served on PORT.
package main

import (
	"cmp"
	"log"
	"os"

	implementation "github.com/ipjohnson/RequestBench/frameworks/go/echo/Implementation"
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
	e := implementation.Router(payloads)
	// Start serves until SIGINT or SIGTERM, and then shuts the server down gracefully.
	if err := e.Start("0.0.0.0:" + cmp.Or(os.Getenv("PORT"), "8080")); err != nil {
		log.Fatal(err)
	}
}
