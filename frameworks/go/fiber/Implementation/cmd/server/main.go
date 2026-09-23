// The server: the payloads loaded from RB_PAYLOADS, then the app served on PORT.
package main

import (
	"cmp"
	"log"
	"os"

	"github.com/gofiber/fiber/v3"

	implementation "github.com/ipjohnson/RequestBench/frameworks/go/fiber/Implementation"
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
	app := implementation.App(payloads)
	log.Fatal(app.Listen("0.0.0.0:"+cmp.Or(os.Getenv("PORT"), "8080"), fiber.ListenConfig{DisableStartupMessage: true}))
}
