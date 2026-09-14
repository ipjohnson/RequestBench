package main

import (
	"runtime/debug"
	"strings"
)

// chi exposes no version constant, so read it from the build info the module graph carries.
func chiVersion() string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return ""
	}
	for _, m := range info.Deps {
		if strings.HasPrefix(m.Path, "github.com/go-chi/chi") {
			return m.Version
		}
	}
	return ""
}
