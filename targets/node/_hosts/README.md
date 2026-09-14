# Hosts

A target is a framework plus a host. The framework decides how routes are bound to the
shared domain module; the host decides what invokes them.

Every `<framework>/app.js` exports two things:

    listen(port)   the framework's own server, started its own way
    handler        a (req, res) function, for a host that brings its own server

`container` calls `listen`, because what people deploy is the framework's own server.
The function hosts pass `handler` to theirs, because that is what actually happens on
Lambda, on Azure Functions and on Cloud Run. Neither is a wrapper around the other.

Every host carries its own bare baseline, so a framework on `gcp-func` is reported
against a bare handler on `gcp-func`. Without that the ratio would charge the framework
for the host's own overhead.
