//! The open-loop load over HTTP/1.1: one thread per worker, each taking every `workers`-th
//! instance of a phase on connections of its own, from a start every thread shares.
//!
//! An instance is timed from its scheduled moment rather than from when it was sent, which is
//! the coordinated-omission correction: a backlog in the generator or the framework shows up as
//! latency instead of quietly vanishing. The instance is bytes built before the load began, so a
//! thread writes them and reads an answer, and the time runs until its last byte arrives. An
//! answer that closed its connection is timed until the connection replacing it is open, so a
//! framework's close is charged to the test that caused it.
use std::cell::{Cell, RefCell};
use std::collections::VecDeque;
use std::rc::Rc;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use tokio::io::Interest;
use tokio::net::TcpStream;
use tokio::sync::{Notify, mpsc};
use tokio::task::{JoinSet, LocalSet};

use crate::http1::{Answer, Read, Reader};
use crate::tally::Tally;

/// One instance as the load sends it.
pub struct Instance {
    pub bytes: Vec<u8>,
    /// An answer to HEAD ends with its headers, whatever they say about a body.
    pub head: bool,
    /// The method and target, as a mismatch line names them.
    pub label: String,
    /// The statuses the test declared, any one of which is right.
    pub accepted: Vec<u16>,
    /// What this request's 2xx body measured at priming, which every answer has to measure again.
    pub body_bytes: Option<u64>,
}

pub struct Test {
    pub instances: Vec<Instance>,
}

/// One phase, counted in instances across every thread.
#[derive(Clone, Copy)]
pub struct Schedule {
    pub rps: f64,
    /// Instances that run before the recorded ones, on the same schedule and unrecorded.
    pub settle: u64,
    /// Recorded instances.
    pub total: u64,
}

pub struct Report {
    pub tallies: Vec<Tally>,
    /// The settle's instances, whichever test they picked.
    pub settle: Tally,
    /// Started and still in flight when the drain gave up.
    pub unfinished: u64,
    /// When the last instance finished, or None when none did.
    pub last: Option<Instant>,
}

pub struct Phased {
    pub start: Instant,
    /// The settle dropped more than the phase allows, so nothing recorded or later ran.
    pub aborted: bool,
    pub reports: Vec<Report>,
}

enum ToWorker {
    Phase { schedule: Schedule, start: Instant, stop: Arc<AtomicBool> },
}

enum FromWorker {
    Ready,
    Settled { dropped: u64 },
    Done(Report),
    Failed(String),
}

/// How long a thread waits for what is still in flight once a phase's schedule has run out.
const DRAIN: Duration = Duration::from_secs(10);

/// The threads that time every phase, started once so each keeps its connections from one phase
/// to the next.
pub struct Load {
    workers: Vec<(mpsc::UnboundedSender<ToWorker>, JoinHandle<()>)>,
    from: mpsc::UnboundedReceiver<(usize, FromWorker)>,
}

struct Job {
    host: String,
    port: u16,
    tests: Arc<Vec<Test>>,
    /// This thread takes every `workers`-th instance of a phase, settle and recorded alike, starting at this one.
    index: usize,
    workers: usize,
    /// This thread's share of the load's connections, which is also its in-flight limit.
    connections: usize,
    seed: u32,
}

/// Seeds for the threads, as cli.ts gave its worker threads.
fn seed_of(i: usize) -> u32 {
    0x9e37_79b9u32.wrapping_mul(i as u32 + 1)
}

impl Load {
    pub async fn open(host: String, port: u16, tests: Vec<Test>, workers: usize, connections: usize) -> Result<Load, String> {
        let tests = Arc::new(tests);
        let (to_main, from) = mpsc::unbounded_channel();
        let mut threads = Vec::new();
        for index in 0..workers {
            let (to, rx) = mpsc::unbounded_channel();
            let job = Job {
                host: host.clone(),
                port,
                tests: tests.clone(),
                index,
                workers,
                connections: connections.div_ceil(workers),
                seed: seed_of(index),
            };
            let tx = to_main.clone();
            let handle = std::thread::Builder::new()
                .name(format!("load-{index}"))
                .spawn(move || {
                    let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().expect("a runtime");
                    LocalSet::new().block_on(&runtime, worker(job, rx, tx));
                })
                .map_err(|e| e.to_string())?;
            threads.push((to, handle));
        }
        let mut load = Load { workers: threads, from };
        let mut ready = 0;
        while ready < workers {
            match load.from.recv().await {
                Some((_, FromWorker::Ready)) => ready += 1,
                Some((_, FromWorker::Failed(why))) => {
                    load.close();
                    return Err(why);
                }
                Some(_) => {}
                None => return Err("a load thread stopped before it was ready".into()),
            }
        }
        Ok(load)
    }

    /// One phase on every thread, from a start they share until the last of them has drained.
    /// The settle is judged on the drops of every thread together, so no thread goes on while
    /// another stops.
    pub async fn phase(&mut self, schedule: Schedule, limit: Option<f64>) -> Result<Phased, String> {
        let stop = Arc::new(AtomicBool::new(false));
        // Far enough ahead that it reaches each thread before it passes, so an instance is due at
        // the same moment whichever thread holds it.
        let start = Instant::now() + Duration::from_millis(50);
        for (to, _) in &self.workers {
            to.send(ToWorker::Phase { schedule, start, stop: stop.clone() }).map_err(|_| "a load thread stopped".to_string())?;
        }
        let n = self.workers.len();
        let (mut settled, mut dropped, mut aborted) = (0, 0, false);
        let mut reports: Vec<Option<Report>> = (0..n).map(|_| None).collect();
        while reports.iter().any(Option::is_none) {
            let Some((i, message)) = self.from.recv().await else {
                return Err("a load thread stopped during a phase".into());
            };
            match message {
                FromWorker::Settled { dropped: d } => {
                    settled += 1;
                    dropped += d;
                    if let Some(limit) = limit.filter(|_| settled == n && schedule.settle > 0) {
                        aborted = dropped as f64 / schedule.settle as f64 > limit;
                        if aborted {
                            stop.store(true, Ordering::Relaxed);
                        }
                    }
                }
                FromWorker::Done(report) => reports[i] = Some(report),
                FromWorker::Failed(why) => return Err(why),
                FromWorker::Ready => {}
            }
        }
        Ok(Phased { start, aborted, reports: reports.into_iter().map(Option::unwrap).collect() })
    }

    pub fn close(self) {
        let Load { workers, .. } = self;
        let handles: Vec<JoinHandle<()>> = workers
            .into_iter()
            .map(|(to, handle)| {
                drop(to);
                handle
            })
            .collect();
        for handle in handles {
            let _ = handle.join();
        }
    }
}

async fn worker(job: Job, mut rx: mpsc::UnboundedReceiver<ToWorker>, tx: mpsc::UnboundedSender<(usize, FromWorker)>) {
    let index = job.index;
    let state = Rc::new(State::new(job));
    // Opened before the thread says it is ready, so the first instance of the first phase finds
    // a connection waiting rather than paying for one inside its own time.
    if let Err(why) = state.open().await {
        let _ = tx.send((index, FromWorker::Failed(why)));
        return;
    }
    let _ = tx.send((index, FromWorker::Ready));
    while let Some(ToWorker::Phase { schedule, start, stop }) = rx.recv().await {
        let message = match state.phase(schedule, start, &stop, &tx).await {
            Ok(report) => FromWorker::Done(report),
            Err(why) => FromWorker::Failed(why),
        };
        let _ = tx.send((index, message));
    }
    state.stopped.set(true);
}

/// Which tally an instance counts toward, and when it was due.
#[derive(Clone, Copy)]
struct Pending {
    due: Instant,
    /// A settle instance counts toward the settle alone, and toward no test's row.
    settle: bool,
    test: usize,
    instance: usize,
    /// The phase it was sent in. An answer that arrives after its phase reported counts nowhere.
    phase: u64,
}

struct Conn {
    stream: TcpStream,
    reader: RefCell<Reader>,
    pending: Cell<Option<Pending>>,
    /// The part of a request one write could not take.
    out: RefCell<Vec<u8>>,
    wake: Notify,
    gone: Cell<bool>,
}

struct PhaseTally {
    tallies: Vec<Tally>,
    settle: Tally,
    last: Option<Instant>,
}

struct State {
    job: Job,
    random: Cell<u32>,
    /// Connections waiting for a request, handed out in turn so every connection the load
    /// declares carries traffic.
    free: RefCell<VecDeque<Rc<Conn>>>,
    /// Connections open or being opened.
    live: Cell<usize>,
    /// Not reset between phases, because an instance the drain gave up on still holds its connection.
    inflight: Cell<usize>,
    phase: RefCell<Option<PhaseTally>>,
    number: Cell<u64>,
    stopped: Cell<bool>,
}

impl State {
    fn new(job: Job) -> Self {
        let seed = if job.seed == 0 { 1 } else { job.seed };
        State {
            job,
            random: Cell::new(seed),
            free: RefCell::new(VecDeque::new()),
            live: Cell::new(0),
            inflight: Cell::new(0),
            phase: RefCell::new(None),
            number: Cell::new(0),
            stopped: Cell::new(false),
        }
    }

    /// xorshift32, so each thread walks the tests and their instances its own way, and every run
    /// the same way, as worker.ts did.
    fn random(&self) -> f64 {
        let mut s = self.random.get();
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        self.random.set(s);
        s as f64 / 4_294_967_296.0
    }

    /// Opens what the thread is short of and waits for it. Called before the first phase and
    /// again before each one after it, so a phase begins with the connections the load declared.
    async fn open(self: &Rc<Self>) -> Result<(), String> {
        let missing = self.job.connections.saturating_sub(self.live.get());
        let mut made = JoinSet::new();
        for _ in 0..missing {
            let state = self.clone();
            made.spawn_local(async move { state.connect().await });
        }
        while let Some(joined) = made.join_next().await {
            let conn = joined.map_err(|e| e.to_string())??;
            self.free.borrow_mut().push_back(conn);
        }
        Ok(())
    }

    async fn connect(self: &Rc<Self>) -> Result<Rc<Conn>, String> {
        self.live.set(self.live.get() + 1);
        let made = TcpStream::connect((self.job.host.as_str(), self.job.port)).await.and_then(|s| s.set_nodelay(true).map(|()| s));
        match made {
            Ok(stream) => {
                let conn = Rc::new(Conn {
                    stream,
                    reader: RefCell::new(Reader::new()),
                    pending: Cell::new(None),
                    out: RefCell::new(Vec::new()),
                    wake: Notify::new(),
                    gone: Cell::new(false),
                });
                tokio::task::spawn_local(drive(self.clone(), conn.clone()));
                Ok(conn)
            }
            Err(e) => {
                self.live.set(self.live.get() - 1);
                Err(format!("connect: {e}"))
            }
        }
    }

    async fn phase(
        self: &Rc<Self>,
        schedule: Schedule,
        start: Instant,
        stop: &AtomicBool,
        tx: &mpsc::UnboundedSender<(usize, FromWorker)>,
    ) -> Result<Report, String> {
        // The phase begins with the connections the load declared, however many the framework
        // closed during the one before it. The start is far enough ahead that this lands before it.
        self.open().await?;
        self.number.set(self.number.get() + 1);
        let tests = self.job.tests.len();
        *self.phase.borrow_mut() =
            Some(PhaseTally { tallies: (0..tests).map(|_| Tally::new()).collect(), settle: Tally::new(), last: None });
        let period = 1e9 / schedule.rps;
        let due = |k: u64| start + Duration::from_nanos((k as f64 * period).round() as u64);
        let end = schedule.settle + schedule.total;
        let step = self.job.workers as u64;
        let mut next = self.job.index as u64;
        let mut told = schedule.settle == 0;
        loop {
            let now = Instant::now();
            while next < end && !stop.load(Ordering::Relaxed) {
                let at = due(next);
                if at > now {
                    break;
                }
                self.fire(next, at, schedule.settle);
                next += step;
            }
            if !told && next >= schedule.settle {
                // An instance is dropped at its scheduled moment or not at all, so every drop in
                // this thread's share of the settle is already counted.
                told = true;
                let dropped = self.phase.borrow().as_ref().map_or(0, |p| p.settle.dropped);
                let _ = tx.send((self.job.index, FromWorker::Settled { dropped }));
            }
            if stop.load(Ordering::Relaxed) || next >= end {
                break;
            }
            // tokio's timer is a millisecond coarse, which would land in the latency being
            // measured, so the thread yields in a spin unless the next instance is further off.
            let wait = due(next).saturating_duration_since(Instant::now());
            if wait > Duration::from_millis(4) {
                tokio::time::sleep(wait - Duration::from_millis(1)).await;
            } else {
                tokio::task::yield_now().await;
            }
        }
        let deadline = Instant::now() + DRAIN;
        while self.inflight.get() > 0 && Instant::now() < deadline {
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
        let tally = self.phase.borrow_mut().take().expect("the phase's tallies");
        Ok(Report { tallies: tally.tallies, settle: tally.settle, unfinished: self.inflight.get() as u64, last: tally.last })
    }

    fn fire(self: &Rc<Self>, k: u64, at: Instant, settle: u64) {
        let tests = &self.job.tests;
        let test = (self.random() * tests.len() as f64) as usize;
        let settling = k < settle;
        if self.inflight.get() >= self.job.connections {
            // Dropped by never being sent, so it enters no histogram. A rate with drops is
            // reported with its drop count, because percentiles over the survivors flatter a
            // collapse.
            if let Some(p) = self.phase.borrow_mut().as_mut() {
                if settling { p.settle.dropped += 1 } else { p.tallies[test].dropped += 1 }
            }
            return;
        }
        let instances = &tests[test].instances;
        let instance = (self.random() * instances.len() as f64) as usize;
        self.inflight.set(self.inflight.get() + 1);
        let pending = Pending { due: at, settle: settling, test, instance, phase: self.number.get() };
        let free = self.free.borrow_mut().pop_front();
        match free {
            Some(conn) => self.send(&conn, pending),
            // No connection is free though the limit is not reached, so the framework closed one
            // without saying so. This instance opens its replacement and pays for it.
            None => {
                let state = self.clone();
                tokio::task::spawn_local(async move {
                    match state.connect().await {
                        Ok(conn) => state.send(&conn, pending),
                        Err(why) => state.failed(Some(pending), &why),
                    }
                });
            }
        }
    }

    fn send(self: &Rc<Self>, conn: &Rc<Conn>, pending: Pending) {
        let instance = &self.job.tests[pending.test].instances[pending.instance];
        conn.reader.borrow_mut().begin(instance.head, false);
        conn.pending.set(Some(pending));
        match conn.stream.try_write(&instance.bytes) {
            Ok(n) if n == instance.bytes.len() => {}
            Ok(n) => {
                conn.out.borrow_mut().extend_from_slice(&instance.bytes[n..]);
                conn.wake.notify_one();
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                conn.out.borrow_mut().extend_from_slice(&instance.bytes);
                conn.wake.notify_one();
            }
            Err(e) => {
                conn.pending.take();
                self.retire(conn);
                self.failed(Some(pending), &e.to_string());
            }
        }
    }

    /// What the connection read, or that it ended.
    fn read(self: &Rc<Self>, conn: &Rc<Conn>, read: Read) {
        match read {
            Read::More => {}
            Read::Done(answer) => {
                let pending = conn.pending.take();
                if !conn.reader.borrow().ends() && !conn.gone.get() {
                    self.free.borrow_mut().push_back(conn.clone());
                    return self.answered(pending, &answer, Instant::now());
                }
                // The answer closed its connection. Its replacement is opened now and the answer
                // is counted once the replacement is up, so the handshake is charged to the test
                // whose answer cost it, and not to whichever instance next finds no connection
                // free. A replacement that cannot be made leaves the answer counted, and the next
                // instance that needs a connection opens one.
                self.retire(conn);
                if self.stopped.get() {
                    return self.answered(pending, &answer, Instant::now());
                }
                let state = self.clone();
                tokio::task::spawn_local(async move {
                    if let Ok(replacement) = state.connect().await {
                        state.free.borrow_mut().push_back(replacement);
                    }
                    state.answered(pending, &answer, Instant::now());
                });
            }
            Read::Failed(why) => {
                let pending = conn.pending.take();
                self.retire(conn);
                self.failed(pending, &why);
            }
        }
    }

    fn answered(&self, pending: Option<Pending>, answer: &Answer, end: Instant) {
        self.inflight.set(self.inflight.get().saturating_sub(1));
        let Some(p) = pending.filter(|p| p.phase == self.number.get()) else { return };
        let mut phase = self.phase.borrow_mut();
        let Some(phase) = phase.as_mut() else { return };
        phase.last = Some(end);
        let request = &self.job.tests[p.test].instances[p.instance];
        let tally = if p.settle { &mut phase.settle } else { &mut phase.tallies[p.test] };
        if !request.accepted.contains(&answer.status) {
            tally.mismatched(|| {
                let accepted: Vec<String> = request.accepted.iter().map(u16::to_string).collect();
                format!("{} answered {}, expected {}", request.label, answer.status, accepted.join(" or "))
            });
        } else if let Some(expected) = request.body_bytes.filter(|&b| b != answer.body_bytes) {
            // The body this request answered with at priming is the one it answers with under
            // load. A framework that starts answering something else is not serving what is being
            // measured.
            tally.mismatched(|| format!("{} answered {} bytes, expected {expected}", request.label, answer.body_bytes));
        }
        tally.time(end.duration_since(p.due).as_nanos() as f64 / 1000.0);
    }

    fn failed(&self, pending: Option<Pending>, why: &str) {
        self.inflight.set(self.inflight.get().saturating_sub(1));
        let Some(p) = pending.filter(|p| p.phase == self.number.get()) else { return };
        if let Some(phase) = self.phase.borrow_mut().as_mut() {
            let tally = if p.settle { &mut phase.settle } else { &mut phase.tallies[p.test] };
            tally.error(why);
        }
    }

    /// A connection that carries nothing more. One the framework closed while it was idle is
    /// opened again at the next phase, or by the instance that needs it first. Opening one the
    /// moment it goes would instead chase a framework whose keep-alive idles out.
    fn retire(&self, conn: &Rc<Conn>) {
        if conn.gone.replace(true) {
            return;
        }
        self.live.set(self.live.get() - 1);
        self.free.borrow_mut().retain(|c| !Rc::ptr_eq(c, conn));
        conn.wake.notify_one();
    }
}

/// One connection's reads, and the writes one call could not finish.
async fn drive(state: Rc<State>, conn: Rc<Conn>) {
    let mut buf = vec![0u8; 64 * 1024];
    while !conn.gone.get() {
        let writing = !conn.out.borrow().is_empty();
        let interest = if writing { Interest::READABLE | Interest::WRITABLE } else { Interest::READABLE };
        tokio::select! {
            ready = conn.stream.ready(interest) => {
                let ready = match ready {
                    Ok(ready) => ready,
                    Err(e) => {
                        let pending = conn.pending.take();
                        state.retire(&conn);
                        if pending.is_some() {
                            state.failed(pending, &e.to_string());
                        }
                        return;
                    }
                };
                if ready.is_writable() && writing {
                    let written = conn.stream.try_write(&conn.out.borrow());
                    match written {
                        Ok(n) => {
                            conn.out.borrow_mut().drain(..n);
                        }
                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
                        Err(e) => {
                            let pending = conn.pending.take();
                            state.retire(&conn);
                            state.failed(pending, &e.to_string());
                            return;
                        }
                    }
                }
                if ready.is_readable() {
                    loop {
                        match conn.stream.try_read(&mut buf) {
                            Ok(0) => {
                                let read = conn.reader.borrow_mut().closed();
                                state.read(&conn, read);
                                state.retire(&conn);
                                return;
                            }
                            Ok(n) => {
                                let read = conn.reader.borrow_mut().feed(&buf[..n]);
                                state.read(&conn, read);
                                if conn.gone.get() {
                                    return;
                                }
                            }
                            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => break,
                            Err(e) => {
                                let pending = conn.pending.take();
                                state.retire(&conn);
                                if pending.is_some() {
                                    state.failed(pending, &e.to_string());
                                }
                                return;
                            }
                        }
                    }
                }
            }
            () = conn.wake.notified() => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use std::io::{Read as _, Write as _};
    use std::net::{Shutdown, TcpListener};
    use std::sync::Mutex;
    use std::sync::atomic::AtomicUsize;

    use super::*;

    const OK: &str = "HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\n{}";

    /// A server that writes whatever `answer` returns for the n-th request, byte for byte, and
    /// closes the connection after it when told to.
    struct Stub {
        port: u16,
        /// Every connection it accepted, in order.
        accepted: Arc<Mutex<Vec<std::net::TcpStream>>>,
    }

    impl Stub {
        fn start(answer: impl Fn(usize) -> (&'static str, bool) + Send + Sync + 'static) -> Stub {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let port = listener.local_addr().unwrap().port();
            let accepted = Arc::new(Mutex::new(Vec::new()));
            let answer = Arc::new(answer);
            let requests = Arc::new(AtomicUsize::new(0));
            let kept = accepted.clone();
            std::thread::spawn(move || {
                for stream in listener.incoming() {
                    let Ok(mut stream) = stream else { return };
                    kept.lock().unwrap().push(stream.try_clone().unwrap());
                    let (answer, requests) = (answer.clone(), requests.clone());
                    std::thread::spawn(move || {
                        let mut seen = Vec::new();
                        let mut chunk = [0u8; 4096];
                        loop {
                            while !seen.windows(4).any(|w| w == b"\r\n\r\n") {
                                match stream.read(&mut chunk) {
                                    Ok(0) | Err(_) => return,
                                    Ok(n) => seen.extend_from_slice(&chunk[..n]),
                                }
                            }
                            let end = seen.windows(4).position(|w| w == b"\r\n\r\n").unwrap() + 4;
                            seen.drain(..end);
                            let (text, close) = answer(requests.fetch_add(1, Ordering::SeqCst));
                            if stream.write_all(text.as_bytes()).is_err() || close {
                                let _ = stream.shutdown(Shutdown::Both);
                                return;
                            }
                        }
                    });
                }
            });
            Stub { port, accepted }
        }

        fn connections(&self) -> usize {
            self.accepted.lock().unwrap().len()
        }
    }

    fn only(method: &str) -> Vec<Test> {
        let bytes = format!("{method} /x HTTP/1.1\r\nhost: stub\r\n\r\n").into_bytes();
        vec![Test {
            instances: vec![Instance {
                bytes,
                head: method == "HEAD",
                label: format!("{method} /x"),
                accepted: vec![200],
                body_bytes: None,
            }],
        }]
    }

    async fn two(load: &mut Load) -> Tally {
        let mut phased = load.phase(Schedule { rps: 100.0, settle: 0, total: 2 }, None).await.unwrap();
        phased.reports.remove(0).tallies.remove(0)
    }

    #[tokio::test]
    async fn an_answer_that_closes_its_connection_is_counted_once_its_replacement_is_open() {
        let stub =
            Stub::start(
                |n| if n == 0 { ("HTTP/1.1 200 OK\r\ncontent-length: 2\r\nconnection: close\r\n\r\n{}", true) } else { (OK, false) },
            );
        let mut load = Load::open("127.0.0.1".into(), stub.port, only("GET"), 1, 1).await.unwrap();
        let t = two(&mut load).await;
        load.close();
        assert_eq!((t.count, t.errors, t.mismatch, t.dropped), (2, 0, 0, 0));
        assert_eq!(stub.connections(), 2, "the second request went out on the replacement");
    }

    #[tokio::test]
    async fn a_head_answer_with_no_length_ends_at_its_headers_and_keeps_its_connection() {
        let stub = Stub::start(|_| ("HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n", false));
        let mut load = Load::open("127.0.0.1".into(), stub.port, only("HEAD"), 1, 1).await.unwrap();
        let t = two(&mut load).await;
        load.close();
        assert_eq!((t.count, t.errors, t.mismatch), (2, 0, 0));
        assert_eq!(stub.connections(), 1, "both requests went out on one connection");
    }

    #[tokio::test]
    async fn a_connection_the_framework_closes_while_idle_is_opened_again_only_by_the_next_phase() {
        let stub = Stub::start(|_| (OK, false));
        let mut load = Load::open("127.0.0.1".into(), stub.port, only("GET"), 1, 1).await.unwrap();
        stub.accepted.lock().unwrap()[0].shutdown(Shutdown::Both).unwrap();
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert_eq!(stub.connections(), 1, "nothing chased the idle close");
        let t = two(&mut load).await;
        load.close();
        assert_eq!((t.count, t.errors), (2, 0));
        assert_eq!(stub.connections(), 2);
    }
}
