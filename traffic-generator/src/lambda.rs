//! The Lambda Runtime API, served to one function's runtime client, which asks for each event on
//! `GET /next` and answers it on `POST /invocation/{id}/response`. The server is the traffic
//! source: it answers a `/next` the moment it arrives, with an event built before anything is
//! timed. Every connection the runtime opens belongs to the one environment.
//!
//! Each invocation is timed on one clock, as Lambda's Telemetry API names its spans:
//!   t0  just before the event is written      t1  the first bytes of the /response head
//!   t2  the /response body is whole           t3  the next /next arrives
//! responseLatency runs from t0 to t1, responseDuration from t1 to t2, and runtimeOverhead from
//! t2 to t3. The invoke phase runs from t0 to t3, because Lambda ends it at the next /next.
//!
//! The gate and priming send one event at a time through `exchange`, which waits for the runtime
//! to ask. A phase hands out events as fast as the runtime asks for them, and checks each answer's
//! status and length against priming after it has handed out the next event, so the check never
//! sits inside a span.
//!
//! An answer is read as a Function URL's caller reads it. That caller gets no body in an answer to
//! HEAD, whatever the function posted.
use std::cell::{Cell, RefCell};
use std::collections::VecDeque;
use std::rc::Rc;
use std::sync::LazyLock;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use base64::Engine;
use serde_json::{Value, json};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;
#[cfg(test)]
use tokio::task::LocalSet;

use crate::apigw::{self, Answered};
use crate::histogram::{BUCKETS, bucket_of};
use crate::inbound::{Inbound, RequestReader};
use crate::request::Request;

const NEXT: &str = "/2018-06-01/runtime/invocation/next";
const INVOCATION: &str = "/2018-06-01/runtime/invocation/";
const INIT_ERROR: &str = "/2018-06-01/runtime/init/error";
const ID_PREFIX: &str = "00000000-0000-4000-8000-";
const DEADLINE: &str = "Lambda-Runtime-Deadline-Ms: ";
const ARN: &str = "arn:aws:lambda:us-east-1:000000000000:function:rb";
const TRACE: &str = "Root=1-66f1a2b3-0123456789abcdef01234567;Parent=0123456789abcdef;Sampled=0";
/// How long a function has for one event, which the deadline tells its runtime.
const TIMEOUT_MS: u64 = 30_000;
/// A phase fails when the runtime neither asks nor answers for this long.
const STALL: Duration = Duration::from_secs(10);

/// One write each, so a runtime on hyper finds the whole reply buffered and keeps the connection.
/// .NET's client throws on a 202 to `/error` that carries no JSON.
static ACCEPTED: LazyLock<Vec<u8>> = LazyLock::new(|| reply("202 Accepted", r#"{"status":"OK"}"#));
static INVALID: LazyLock<Vec<u8>> =
    LazyLock::new(|| reply("400 Bad Request", r#"{"errorMessage":"Invalid request ID","errorType":"InvalidRequestID"}"#));
static NOT_FOUND: LazyLock<Vec<u8>> =
    LazyLock::new(|| reply("404 Not Found", r#"{"errorMessage":"no such route","errorType":"NotFound"}"#));

fn reply(status: &str, body: &str) -> Vec<u8> {
    format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}", body.len()).into_bytes()
}

fn epoch_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64)
}

/// An event as its whole `/next` answer: the status line, the `Lambda-Runtime-*` headers and the
/// event. The request id's last 12 hex digits and the deadline's 13 digits are patched in place.
pub struct NextAnswer {
    bytes: Vec<u8>,
    id_at: usize,
    deadline_at: usize,
}

impl NextAnswer {
    pub fn new(event: &[u8]) -> NextAnswer {
        let head = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nLambda-Runtime-Aws-Request-Id: {ID_PREFIX}000000000000\r\n\
             {DEADLINE}0000000000000\r\nLambda-Runtime-Invoked-Function-Arn: {ARN}\r\nLambda-Runtime-Trace-Id: {TRACE}\r\n\
             Content-Length: {}\r\n\r\n",
            event.len()
        );
        let id_at = head.find(ID_PREFIX).expect("the request id") + ID_PREFIX.len();
        let deadline_at = head.find(DEADLINE).expect("the deadline") + DEADLINE.len();
        let mut bytes = head.into_bytes();
        bytes.extend_from_slice(event);
        NextAnswer { bytes, id_at, deadline_at }
    }

    fn stamp(&mut self, number: u64, deadline_ms: u64) {
        patch(&mut self.bytes, self.id_at, 12, number, 16);
        patch(&mut self.bytes, self.deadline_at, 13, deadline_ms, 10);
    }
}

fn patch(buf: &mut [u8], at: usize, width: usize, mut value: u64, radix: u64) {
    for i in (0..width).rev() {
        let d = (value % radix) as u8;
        buf[at + i] = if d < 10 { b'0' + d } else { b'a' + d - 10 };
        value /= radix;
    }
}

/// One instance as a phase hands it out.
pub struct Instance {
    pub answer: NextAnswer,
    /// The method and target, as a mismatch line names them.
    pub label: String,
    pub accepted: Vec<u16>,
    /// What this request's 2xx body measured at priming, which every answer has to measure again.
    pub body_bytes: Option<u64>,
    pub head: bool,
}

/// One test's invocations: its spans on the histogram layout histogram.ts reads, and what went wrong.
pub struct Spans {
    pub count: u64,
    pub errors: u64,
    pub mismatch: u64,
    /// Every invoke phase, when the spans have no windows, as the settle's have none.
    invoke: Vec<u32>,
    /// The invoke phase in each window of the recording. An invocation is counted in one of these
    /// or in `invoke`, never both, and `json` reports `invoke` as the sum.
    windows: Vec<Vec<u32>>,
    response: Vec<u32>,
    latency: Vec<u32>,
    duration: Vec<u32>,
    overhead: Vec<u32>,
    first_error: Option<String>,
    first_mismatch: Option<String>,
}

impl Spans {
    fn new() -> Spans {
        Spans::windowed(0)
    }

    /// Spans with their windows allocated, so none is allocated while a phase is timed.
    fn windowed(windows: usize) -> Spans {
        let hist = || vec![0u32; BUCKETS];
        Spans {
            count: 0,
            errors: 0,
            mismatch: 0,
            invoke: hist(),
            windows: (0..windows).map(|_| hist()).collect(),
            response: hist(),
            latency: hist(),
            duration: hist(),
            overhead: hist(),
            first_error: None,
            first_mismatch: None,
        }
    }

    /// One invocation's spans. Its invoke phase goes in window `window`, in the last window when it
    /// is past them, or in `invoke` when there are none.
    fn time(&mut self, t0: Instant, t1: Instant, t2: Instant, t3: Instant, window: usize) {
        let us = |from: Instant, to: Instant| to.saturating_duration_since(from).as_nanos() as f64 / 1000.0;
        let last = self.windows.len().saturating_sub(1);
        let invoke = match self.windows.get_mut(window.min(last)) {
            Some(hist) => hist,
            None => &mut self.invoke,
        };
        invoke[bucket_of(us(t0, t3))] += 1;
        self.response[bucket_of(us(t0, t2))] += 1;
        self.latency[bucket_of(us(t0, t1))] += 1;
        self.duration[bucket_of(us(t1, t2))] += 1;
        self.overhead[bucket_of(us(t2, t3))] += 1;
        self.count += 1;
    }

    fn error(&mut self, why: &str) {
        self.errors += 1;
        self.first_error.get_or_insert_with(|| why.to_string());
    }

    fn mismatched(&mut self, why: impl FnOnce() -> String) {
        self.mismatch += 1;
        self.first_mismatch.get_or_insert_with(why);
    }

    fn json(&self) -> Value {
        let b64 = |hist: &[u32]| {
            let bytes: Vec<u8> = hist.iter().flat_map(|n| n.to_le_bytes()).collect();
            base64::engine::general_purpose::STANDARD.encode(bytes)
        };
        let mut invoke = self.invoke.clone();
        for window in &self.windows {
            for (into, n) in invoke.iter_mut().zip(window) {
                *into += n;
            }
        }
        json!({
            "count": self.count,
            "errors": self.errors,
            "mismatch": self.mismatch,
            "firstError": self.first_error,
            "firstMismatch": self.first_mismatch,
            "invoke": b64(&invoke),
            "windows": self.windows.iter().map(|w| b64(w)).collect::<Vec<_>>(),
            "response": b64(&self.response),
            "responseLatency": b64(&self.latency),
            "responseDuration": b64(&self.duration),
            "runtimeOverhead": b64(&self.overhead),
        })
    }
}

struct Conn {
    stream: TcpStream,
    gone: Cell<bool>,
}

/// An event waiting for the runtime to ask, and who wants its answer.
struct Queued {
    answer: NextAnswer,
    done: oneshot::Sender<Result<Answered, String>>,
}

/// What the runtime answered: when, and what.
struct Answer {
    t1: Instant,
    t2: Instant,
    body: Vec<u8>,
    streamed: bool,
    /// The body of `/invocation/{id}/error`.
    error: Option<String>,
}

/// The invocation the runtime holds.
enum Current {
    Exchange { number: u64, done: Option<oneshot::Sender<Result<Answered, String>>> },
    Load { number: u64, test: usize, instance: usize, t0: Instant, answered: Option<Answer> },
}

struct Phase {
    settle_until: Instant,
    end: Instant,
    tallies: Vec<Spans>,
    settle: Spans,
    /// The first recorded invocation's t0 and the last one's t3.
    first: Option<Instant>,
    last: Option<Instant>,
    /// The first recorded invocation's test and its t0 to t3. With no settle it is the first event
    /// the function ever answered.
    first_invocation: Option<(usize, [Instant; 4])>,
    /// Each second of the recording, from its start: the invocations whose t0 fell in it, and
    /// their invoke phases summed in nanoseconds.
    seconds: Vec<(u64, u64)>,
    /// How long each window of the recording lasts, or zero for none.
    window_seconds: f64,
    done: Option<oneshot::Sender<Result<(), String>>>,
}

/// The one environment every connection the runtime opens belongs to.
pub struct Env {
    /// When the runtime first asked for an event, which ends its Init phase.
    init: Cell<Option<Instant>>,
    init_error: RefCell<Option<String>>,
    init_waiters: RefCell<Vec<oneshot::Sender<()>>>,
    /// The connection whose `/next` is unanswered.
    waiting: RefCell<Option<Rc<Conn>>>,
    queue: RefCell<VecDeque<Queued>>,
    current: RefCell<Option<Current>>,
    number: Cell<u64>,
    tests: RefCell<Vec<Vec<Instance>>>,
    random: Cell<u32>,
    phase: RefCell<Option<Phase>>,
    finished: RefCell<Option<Phase>>,
    progress: Cell<Instant>,
}

/// The Runtime API on this address. The port it bound is returned, so an address with port 0 works.
pub async fn listen(bind: &str) -> Result<(Rc<Env>, u16), String> {
    let listener = TcpListener::bind(bind).await.map_err(|e| format!("listen on {bind}: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let env = Rc::new(Env {
        init: Cell::new(None),
        init_error: RefCell::new(None),
        init_waiters: RefCell::new(Vec::new()),
        waiting: RefCell::new(None),
        queue: RefCell::new(VecDeque::new()),
        current: RefCell::new(None),
        number: Cell::new(0),
        tests: RefCell::new(Vec::new()),
        random: Cell::new(0x9e37_79b9),
        phase: RefCell::new(None),
        finished: RefCell::new(None),
        progress: Cell::new(Instant::now()),
    });
    let accepting = env.clone();
    tokio::task::spawn_local(async move {
        loop {
            let Ok((stream, _)) = listener.accept().await else { continue };
            let _ = stream.set_nodelay(true);
            let conn = Rc::new(Conn { stream, gone: Cell::new(false) });
            tokio::task::spawn_local(serve(accepting.clone(), conn));
        }
    });
    Ok((env, port))
}

async fn serve(env: Rc<Env>, conn: Rc<Conn>) {
    let mut reader = RequestReader::default();
    let mut buf = vec![0u8; 256 * 1024];
    loop {
        if conn.stream.readable().await.is_err() {
            break;
        }
        match conn.stream.try_read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                let now = Instant::now();
                match reader.feed(&buf[..n], now) {
                    Ok(requests) => {
                        for inbound in requests {
                            env.handle(&conn, inbound, now);
                        }
                    }
                    Err(_) => break,
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => continue,
            Err(_) => break,
        }
    }
    conn.gone.set(true);
    let mut waiting = env.waiting.borrow_mut();
    if waiting.as_ref().is_some_and(|w| Rc::ptr_eq(w, &conn)) {
        *waiting = None;
    }
}

/// A reply in one write where the socket takes it, which it does for anything this small.
fn write(conn: &Rc<Conn>, bytes: &[u8]) {
    match conn.stream.try_write(bytes) {
        Ok(n) if n == bytes.len() => {}
        Ok(n) => finish_write(conn, bytes[n..].to_vec()),
        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => finish_write(conn, bytes.to_vec()),
        Err(_) => conn.gone.set(true),
    }
}

fn finish_write(conn: &Rc<Conn>, mut rest: Vec<u8>) {
    let conn = conn.clone();
    tokio::task::spawn_local(async move {
        while !rest.is_empty() {
            if conn.stream.writable().await.is_err() {
                return;
            }
            match conn.stream.try_write(&rest) {
                Ok(n) => {
                    rest.drain(..n);
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
                Err(_) => return,
            }
        }
    });
}

impl Env {
    fn handle(self: &Rc<Self>, conn: &Rc<Conn>, inbound: Inbound, now: Instant) {
        self.progress.set(now);
        match (inbound.method.as_str(), inbound.path.as_str()) {
            ("GET", NEXT) => self.next(conn, now),
            ("POST", INIT_ERROR) => {
                write(conn, &ACCEPTED);
                *self.init_error.borrow_mut() = Some(String::from_utf8_lossy(&inbound.body).into_owned());
                for waiter in self.init_waiters.take() {
                    let _ = waiter.send(());
                }
            }
            ("POST", path) if path.starts_with(INVOCATION) => {
                let rest = &path[INVOCATION.len()..];
                let (id, what) = rest.split_once('/').unwrap_or((rest, ""));
                let number = id.strip_prefix(ID_PREFIX).and_then(|n| u64::from_str_radix(n, 16).ok());
                match (number, what) {
                    (Some(number), "response") => self.answer(conn, number, inbound, now, None),
                    (Some(number), "error") => {
                        let why = String::from_utf8_lossy(&inbound.body).into_owned();
                        self.answer(conn, number, inbound, now, Some(why));
                    }
                    (None, "response" | "error") => write(conn, &INVALID),
                    _ => write(conn, &NOT_FOUND),
                }
            }
            _ => write(conn, &NOT_FOUND),
        }
    }

    fn next(self: &Rc<Self>, conn: &Rc<Conn>, now: Instant) {
        if self.init.get().is_none() {
            self.init.set(Some(now));
            for waiter in self.init_waiters.take() {
                let _ = waiter.send(());
            }
        }
        let previous = self.current.borrow_mut().take();
        let in_phase = self.phase.borrow().as_ref().map(|p| now < p.end);
        match in_phase {
            // The next event goes out first, and the answer to the one before is read after it.
            Some(true) => {
                self.hand_out(conn);
                if let Some(previous) = previous {
                    self.record(previous, now);
                }
            }
            // The phase's time is up. The runtime waits here until there is more to do.
            Some(false) => {
                *self.waiting.borrow_mut() = Some(conn.clone());
                if let Some(previous) = previous {
                    self.record(previous, now);
                }
                self.end_phase(Ok(()));
            }
            None => {
                if let Some(Current::Exchange { done: Some(done), .. }) = previous {
                    let _ = done.send(Err("the runtime asked for another event without answering this one".into()));
                }
                let queued = self.queue.borrow_mut().pop_front();
                match queued {
                    Some(queued) => self.send_exchange(conn, queued),
                    None => *self.waiting.borrow_mut() = Some(conn.clone()),
                }
            }
        }
    }

    fn send_exchange(&self, conn: &Rc<Conn>, mut queued: Queued) {
        let number = self.number.get() + 1;
        self.number.set(number);
        queued.answer.stamp(number, epoch_ms() + TIMEOUT_MS);
        write(conn, &queued.answer.bytes);
        *self.current.borrow_mut() = Some(Current::Exchange { number, done: Some(queued.done) });
    }

    /// xorshift32, as the open-loop load picks its tests.
    fn random(&self) -> f64 {
        let mut s = self.random.get();
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        self.random.set(s);
        s as f64 / 4_294_967_296.0
    }

    fn hand_out(&self, conn: &Rc<Conn>) {
        let mut tests = self.tests.borrow_mut();
        let test = (self.random() * tests.len() as f64) as usize;
        let instances = &mut tests[test];
        let instance = (self.random() * instances.len() as f64) as usize;
        let number = self.number.get() + 1;
        self.number.set(number);
        let answer = &mut instances[instance].answer;
        answer.stamp(number, epoch_ms() + TIMEOUT_MS);
        let t0 = Instant::now();
        write(conn, &answer.bytes);
        *self.current.borrow_mut() = Some(Current::Load { number, test, instance, t0, answered: None });
    }

    fn answer(&self, conn: &Rc<Conn>, number: u64, inbound: Inbound, now: Instant, error: Option<String>) {
        let streamed = inbound.header("lambda-runtime-function-response-mode") == Some("streaming");
        let mut current = self.current.borrow_mut();
        match current.as_mut() {
            Some(Current::Exchange { number: n, done }) if *n == number && done.is_some() => {
                write(conn, &ACCEPTED);
                let done = done.take().expect("an exchange waiting");
                let answered = match error {
                    Some(why) => Err(format!("the function failed: {why}")),
                    None if streamed => apigw::streamed(&inbound.body),
                    None => apigw::answered(&inbound.body),
                };
                let _ = done.send(answered);
            }
            Some(Current::Load { number: n, answered, .. }) if *n == number && answered.is_none() => {
                write(conn, &ACCEPTED);
                *answered = Some(Answer { t1: inbound.started, t2: now, body: inbound.body, streamed, error });
            }
            _ => write(conn, &INVALID),
        }
    }

    /// An invocation's spans once its t3 is known, and its answer checked against priming.
    fn record(&self, previous: Current, t3: Instant) {
        let Current::Load { test, instance, t0, answered, .. } = previous else { return };
        let mut phase = self.phase.borrow_mut();
        let Some(phase) = phase.as_mut() else { return };
        let recorded = t0 >= phase.settle_until;
        // The window the event went out in. Like the check below, it is worked out after the next
        // event has gone out, so it never sits inside a span. The last event can go out just after
        // the phase's end, which puts it past the last window.
        let window = if recorded && phase.window_seconds > 0.0 {
            (t0.saturating_duration_since(phase.settle_until).as_secs_f64() / phase.window_seconds) as usize
        } else {
            0
        };
        let spans = if recorded { &mut phase.tallies[test] } else { &mut phase.settle };
        let Some(answer) = answered else {
            return spans.error("the runtime asked for another event without answering this one");
        };
        if let Some(why) = answer.error {
            return spans.error(&format!("the function failed: {why}"));
        }
        let answered = if answer.streamed { apigw::streamed(&answer.body) } else { apigw::answered(&answer.body) };
        let tests = self.tests.borrow();
        let request = &tests[test][instance];
        match answered {
            Err(why) => return spans.error(&why),
            Ok(a) if !request.accepted.contains(&a.status) => spans.mismatched(|| {
                let accepted: Vec<String> = request.accepted.iter().map(u16::to_string).collect();
                format!("{} answered {}, expected {}", request.label, a.status, accepted.join(" or "))
            }),
            Ok(a) => {
                let read = if request.head { 0 } else { a.body.len() as u64 };
                if let Some(expected) = request.body_bytes.filter(|&b| b != read) {
                    spans.mismatched(|| format!("{} answered {read} bytes, expected {expected}", request.label));
                }
            }
        }
        spans.time(t0, answer.t1, answer.t2, t3, window);
        if recorded {
            phase.first.get_or_insert(t0);
            phase.last = Some(t3);
            phase.first_invocation.get_or_insert((test, [t0, answer.t1, answer.t2, t3]));
            let second = t0.saturating_duration_since(phase.settle_until).as_secs() as usize;
            if phase.seconds.len() <= second {
                phase.seconds.resize(second + 1, (0, 0));
            }
            phase.seconds[second].0 += 1;
            phase.seconds[second].1 += t3.saturating_duration_since(t0).as_nanos() as u64;
        }
    }

    fn end_phase(&self, result: Result<(), String>) {
        let Some(mut phase) = self.phase.borrow_mut().take() else { return };
        if let Some(done) = phase.done.take() {
            let _ = done.send(result);
        }
        *self.finished.borrow_mut() = Some(phase);
    }

    /// Waits for the runtime's first `/next`, which ends its Init phase, and says when it came.
    pub async fn init(self: &Rc<Self>, timeout: Duration) -> Result<Instant, String> {
        let deadline = Instant::now() + timeout;
        loop {
            if let Some(why) = self.init_error.borrow().as_ref() {
                return Err(format!("the runtime failed its init: {why}"));
            }
            if let Some(at) = self.init.get() {
                return Ok(at);
            }
            let (tx, rx) = oneshot::channel();
            self.init_waiters.borrow_mut().push(tx);
            let left = deadline.saturating_duration_since(Instant::now());
            if tokio::time::timeout(left, rx).await.is_err() {
                return Err(format!("the runtime did not ask for an event within {} s", timeout.as_secs()));
            }
        }
    }

    /// One request as an event, and the answer as a Function URL's caller would read it.
    pub async fn exchange(self: &Rc<Self>, request: &Request, timeout: Duration) -> Result<Value, String> {
        let describe = || format!("{} {}", request.method, request.target);
        let body = request.body()?;
        let event = apigw::event(request, body.as_deref());
        let (done, answer) = oneshot::channel();
        let queued = Queued { answer: NextAnswer::new(&event), done };
        let waiting = self.waiting.borrow_mut().take();
        match waiting {
            Some(conn) if !conn.gone.get() && self.phase.borrow().is_none() => self.send_exchange(&conn, queued),
            _ => self.queue.borrow_mut().push_back(queued),
        }
        let mut answered = match tokio::time::timeout(timeout, answer).await {
            Ok(Ok(Ok(answered))) => answered,
            Ok(Ok(Err(why))) => return Err(format!("{}: {why}", describe())),
            Ok(Err(_)) => return Err(format!("{}: the runtime went away", describe())),
            Err(_) => return Err(format!("{}: no answer within {} s", describe(), timeout.as_secs())),
        };
        if request.is_head() {
            answered.body.clear();
        }
        Ok(json!({
            "status": answered.status,
            "reason": "",
            "version": "lambda",
            "host": apigw::DOMAIN,
            "headers": answered.headers,
            "body": base64::engine::general_purpose::STANDARD.encode(&answered.body),
            "bodyBytes": answered.body.len(),
            "framing": answered.framing,
            "payloadBytes": answered.payload_bytes,
        }))
    }

    pub fn load(&self, tests: Vec<Vec<Instance>>) {
        *self.tests.borrow_mut() = tests;
    }

    /// A closed-loop phase: events handed out as fast as the runtime asks, unrecorded for `settle`
    /// and then recorded for `seconds`, cut into windows `window` long. The runtime keeps its last
    /// `/next` waiting after it.
    pub async fn phase(
        self: &Rc<Self>,
        settle: Duration,
        seconds: Duration,
        window: Duration,
        nanos: impl Fn(Instant) -> u64,
    ) -> Result<Value, String> {
        if self.tests.borrow().is_empty() {
            return Err("a phase before the load was opened".into());
        }
        let windows = if window.is_zero() { 0 } else { (seconds.as_secs_f64() / window.as_secs_f64()).ceil() as usize };
        let (done, finished) = oneshot::channel();
        let start = Instant::now();
        let tests = self.tests.borrow().len();
        *self.phase.borrow_mut() = Some(Phase {
            settle_until: start + settle,
            end: start + settle + seconds,
            tallies: (0..tests).map(|_| Spans::windowed(windows)).collect(),
            settle: Spans::new(),
            first: None,
            last: None,
            first_invocation: None,
            seconds: Vec::new(),
            window_seconds: window.as_secs_f64(),
            done: Some(done),
        });
        self.progress.set(start);
        let waiting = self.waiting.borrow_mut().take();
        if let Some(conn) = waiting.filter(|c| !c.gone.get()) {
            self.hand_out(&conn);
        }
        // A spin keeps the thread polling its sockets rather than sleeping between messages, so a
        // wakeup never sits inside a span.
        let spinning = self.clone();
        tokio::task::spawn_local(async move {
            while spinning.phase.borrow().is_some() {
                tokio::task::yield_now().await;
            }
        });
        let watching = self.clone();
        tokio::task::spawn_local(async move {
            while watching.phase.borrow().is_some() {
                tokio::time::sleep(Duration::from_millis(250)).await;
                if watching.progress.get().elapsed() > STALL {
                    watching.end_phase(Err(format!("the runtime neither asked nor answered for {} s", STALL.as_secs())));
                }
            }
        });
        let result = finished.await.map_err(|_| "the phase ended with no result".to_string())?;
        let phase = self.finished.borrow_mut().take().expect("the finished phase");
        result?;
        let span = |from: Instant, to: Instant| to.saturating_duration_since(from).as_nanos() as u64;
        let first_invocation = phase.first_invocation.map(|(test, [t0, t1, t2, t3])| {
            json!({
                "test": test,
                "invoke": span(t0, t3),
                "response": span(t0, t2),
                "responseLatency": span(t0, t1),
                "responseDuration": span(t1, t2),
                "runtimeOverhead": span(t2, t3),
            })
        });
        Ok(json!({
            "kind": "phase",
            "closed": true,
            "start": nanos(start),
            "first": phase.first.map_or(0, &nanos),
            "last": phase.last.map_or(0, &nanos),
            "settle": phase.settle.json(),
            "tests": phase.tallies.iter().map(Spans::json).collect::<Vec<_>>(),
            "firstInvocation": first_invocation,
            "seconds": phase.seconds,
        }))
    }
}

#[cfg(test)]
mod tests {
    use std::io::{Read, Write};

    use super::*;

    /// One HTTP message off a blocking socket: its head and a body framed by its length.
    fn message(s: &mut std::net::TcpStream, buf: &mut Vec<u8>) -> Option<(String, Vec<u8>)> {
        let mut chunk = [0u8; 65536];
        loop {
            if let Some(end) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                let head = String::from_utf8_lossy(&buf[..end]).into_owned();
                let length = head
                    .lines()
                    .find_map(|l| l.to_ascii_lowercase().strip_prefix("content-length:").map(|v| v.trim().parse::<usize>().unwrap()))
                    .unwrap_or(0);
                if buf.len() >= end + 4 + length {
                    let body = buf[end + 4..end + 4 + length].to_vec();
                    buf.drain(..end + 4 + length);
                    return Some((head, body));
                }
            }
            match s.read(&mut chunk) {
                Ok(0) | Err(_) => return None,
                Ok(n) => buf.extend_from_slice(&chunk[..n]),
            }
        }
    }

    /// A runtime client on a thread of its own that asks for each event and answers it with the
    /// event's path in JSON, over one keep-alive connection, until the server goes.
    fn runtime(port: u16) {
        std::thread::spawn(move || {
            let mut s = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
            s.set_nodelay(true).unwrap();
            let mut buf = Vec::new();
            loop {
                if s.write_all(b"GET /2018-06-01/runtime/invocation/next HTTP/1.1\r\nHost: api\r\n\r\n").is_err() {
                    return;
                }
                let Some((head, event)) = message(&mut s, &mut buf) else { return };
                let id = head.lines().find_map(|l| l.strip_prefix("Lambda-Runtime-Aws-Request-Id: ")).unwrap().to_string();
                let event: Value = serde_json::from_slice(&event).unwrap();
                let body = json!({ "path": event["rawPath"], "length": event["body"].as_str().map_or(0, str::len) }).to_string();
                let answer = json!({ "statusCode": 200, "headers": { "content-type": "application/json" }, "body": body }).to_string();
                let post = format!(
                    "POST /2018-06-01/runtime/invocation/{id}/response HTTP/1.1\r\nHost: api\r\nContent-Length: {}\r\n\r\n{answer}",
                    answer.len()
                );
                if s.write_all(post.as_bytes()).is_err() {
                    return;
                }
                let Some((accepted, _)) = message(&mut s, &mut buf) else { return };
                assert!(accepted.starts_with("HTTP/1.1 202"), "{accepted}");
            }
        });
    }

    fn get(target: &str) -> Request {
        Request { method: "GET".into(), target: target.into(), headers: vec![], body: None }
    }

    #[tokio::test]
    async fn an_exchange_waits_for_the_runtime_and_reads_its_proxy_response() {
        LocalSet::new()
            .run_until(async {
                let (env, port) = listen("127.0.0.1:0").await.unwrap();
                runtime(port);
                env.init(Duration::from_secs(5)).await.unwrap();
                for target in ["/json/small", "/query/one?page=417"] {
                    let answer = env.exchange(&get(target), Duration::from_secs(5)).await.unwrap();
                    assert_eq!(answer["status"], 200);
                    let body = base64::engine::general_purpose::STANDARD.decode(answer["body"].as_str().unwrap()).unwrap();
                    let path = target.split('?').next().unwrap();
                    assert_eq!(String::from_utf8(body).unwrap(), format!(r#"{{"length":0,"path":"{path}"}}"#));
                }
                // The stub posts a body whatever the method, and a caller reads none in an answer to HEAD.
                let head = Request { method: "HEAD".into(), ..get("/items/17") };
                let answer = env.exchange(&head, Duration::from_secs(5)).await.unwrap();
                assert_eq!((answer["status"].as_u64(), answer["bodyBytes"].as_u64()), (Some(200), Some(0)));
            })
            .await;
    }

    #[tokio::test]
    async fn a_closed_loop_phase_times_every_invocation_it_records_and_checks_every_answer() {
        LocalSet::new()
            .run_until(async {
                let (env, port) = listen("127.0.0.1:0").await.unwrap();
                runtime(port);
                env.init(Duration::from_secs(5)).await.unwrap();
                let instance = |path: &str| Instance {
                    answer: NextAnswer::new(&apigw::event(&get(path), None)),
                    label: format!("GET {path}"),
                    accepted: vec![200],
                    body_bytes: Some(format!(r#"{{"length":0,"path":"{path}"}}"#).len() as u64),
                    head: false,
                };
                env.load(vec![vec![instance("/a")], vec![instance("/bb")]]);
                let report = env.phase(Duration::ZERO, Duration::from_millis(300), Duration::from_millis(100), |_| 0).await.unwrap();
                // With no settle the first recorded invocation is the first event the runtime answered.
                let first = &report["firstInvocation"];
                assert!(first["test"].as_u64().unwrap() < 2);
                assert!(first["invoke"].as_u64().unwrap() >= first["response"].as_u64().unwrap());
                let counted: u64 = report["seconds"].as_array().unwrap().iter().map(|s| s[0].as_u64().unwrap()).sum();
                let recorded: u64 = report["tests"].as_array().unwrap().iter().map(|t| t["count"].as_u64().unwrap()).sum();
                assert_eq!(counted, recorded);
                for test in report["tests"].as_array().unwrap() {
                    assert!(test["count"].as_u64().unwrap() > 10, "{test}");
                    assert_eq!((test["errors"].as_u64(), test["mismatch"].as_u64()), (Some(0), Some(0)), "{test}");
                    let timed = |b64: &Value| -> u64 {
                        let hist = base64::engine::general_purpose::STANDARD.decode(b64.as_str().unwrap()).unwrap();
                        hist.chunks(4).map(|b| u64::from(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))).sum()
                    };
                    assert_eq!(timed(&test["invoke"]), test["count"].as_u64().unwrap());
                    // Three windows of 100 ms, which between them hold every invocation. Which one holds
                    // each depends on when the stub's thread ran, so it is not checked.
                    let windows = test["windows"].as_array().unwrap();
                    assert_eq!(windows.len(), 3);
                    assert_eq!(windows.iter().map(timed).sum::<u64>(), test["count"].as_u64().unwrap());
                }
                // After the phase the runtime waits in /next, and an exchange goes straight to it.
                let answer = env.exchange(&get("/after"), Duration::from_secs(5)).await.unwrap();
                assert_eq!(answer["status"], 200);
            })
            .await;
    }
}
