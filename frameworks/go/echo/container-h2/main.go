// The server: the payloads loaded from RB_PAYLOADS, then the router served on PORT over HTTP/2 with
// prior knowledge.
package main

import (
	"cmp"
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/labstack/echo/v5"

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
	// echo's StartConfig hands over its http.Server before serving, and net/http answers HTTP/2
	// with prior knowledge on a server whose Protocols allow unencrypted HTTP/2.
	sc := echo.StartConfig{
		Address: "0.0.0.0:" + cmp.Or(os.Getenv("PORT"), "8080"),
		BeforeServeFunc: func(s *http.Server) error {
			var protocols http.Protocols
			protocols.SetUnencryptedHTTP2(true)
			s.Protocols = &protocols
			return nil
		},
	}
	// Serves until SIGINT or SIGTERM, and then shuts the server down gracefully, as e.Start does.
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if err := sc.Start(ctx, e); err != nil {
		log.Fatal(err)
	}
}
