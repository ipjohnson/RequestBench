// A content-length is written by hand on every response here, because chi routes plain
// net/http handlers and net/http only fills one in for a body small enough to buffer.
// The conformance gate requires the header on every response that has a body.
package main

import "strconv"

func itoa(n int) string { return strconv.Itoa(n) }
