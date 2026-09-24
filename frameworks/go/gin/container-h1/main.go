// The server: the payloads loaded from RB_PAYLOADS, then the router served on PORT.
package main

import (
	"cmp"
	"log"
	"os"

	"github.com/gin-gonic/gin"

	implementation "github.com/ipjohnson/RequestBench/frameworks/go/gin/Implementation"
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
	// Before the router is built, because the template is parsed once only outside debug mode.
	gin.SetMode(gin.ReleaseMode)
	router := implementation.Router(payloads)
	log.Fatal(router.Run("0.0.0.0:" + cmp.Or(os.Getenv("PORT"), "8080")))
}
