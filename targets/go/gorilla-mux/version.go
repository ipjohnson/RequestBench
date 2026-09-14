package main

import (
	"runtime/debug"
	"strings"
)

// gorilla/mux exposes no version constant, so read it from the build info the module graph carries.
func muxVersion() string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return ""
	}
	for _, m := range info.Deps {
		if strings.HasPrefix(m.Path, "github.com/gorilla/mux") {
			return m.Version
		}
	}
	return ""
}
