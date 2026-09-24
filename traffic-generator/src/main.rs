//! The traffic generator's own program: every protocol it speaks and every moment it times. The
//! TypeScript beside it runs the corpus, and talks to this over stdin and stdout, one JSON object
//! to a line:
//!
//!   {"op":"exchange","id":1,"request":{...},"timeoutMs":10000}
//!       -> {"id":1,"answer":{...}} or {"id":1,"error":"..."}
//!   {"op":"open","tests":[...],"workers":4,"connections":256,"streams":1} -> {"kind":"ready"}
//!   {"op":"phase","rps":1000,"settle":30000,"total":60000,"abortDropFraction":0.05,"windowSeconds":10}
//!       -> {"kind":"phase",...}
//!   {"op":"close"}                                               -> {"kind":"closed"}
//!
//! Anything that goes wrong outside an exchange is answered {"kind":"error","message":"..."}.
//!
//!   traffic-generator --target <host:port> [--protocol http/1.1|h2c]
//!
//! With `--listen` it serves the Lambda Runtime API instead, says {"kind":"listening","port":N},
//! and takes {"op":"init"} to wait for the runtime's first /next, the same exchanges and loads, and
//! {"op":"phase","settleSeconds":30,"seconds":60,"windowSeconds":10} for a closed-loop phase.
//!
//!   traffic-generator --listen <host:port> --protocol lambda-runtime-api
mod apigw;
mod exchange;
mod h2c;
mod histogram;
mod http1;
mod inbound;
mod lambda;
mod load;
mod request;
mod tally;

use std::io::Write;
use std::rc::Rc;
use std::sync::LazyLock;
use std::time::{Duration, Instant};

use serde::Deserialize;
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::task::LocalSet;

use crate::exchange::Exchanger;
use crate::h2c::Template;
use crate::load::{Instance, Load, Phased, Schedule, Test, Wire};
use crate::request::{Protocol, Request, http1};
use crate::tally::Tally;

/// What every time this program reports is counted from.
static ORIGIN: LazyLock<Instant> = LazyLock::new(Instant::now);

fn nanos(at: Instant) -> u64 {
    at.saturating_duration_since(*ORIGIN).as_nanos() as u64
}

fn say(message: &Value) {
    let mut out = std::io::stdout().lock();
    let _ = writeln!(out, "{message}");
    let _ = out.flush();
}

fn main() {
    LazyLock::force(&ORIGIN);
    let args: Vec<String> = std::env::args().skip(1).collect();
    let usage = || -> ! {
        eprintln!("usage: traffic-generator --target <host:port> [--protocol http/1.1|h2c]");
        eprintln!("       traffic-generator --listen <host:port> --protocol lambda-runtime-api");
        std::process::exit(2);
    };
    if let [flag, bind, p, name] = args.as_slice()
        && flag == "--listen"
        && p == "--protocol"
        && name == "lambda-runtime-api"
    {
        let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().expect("a runtime");
        return LocalSet::new().block_on(&runtime, run_lambda(bind.clone()));
    }
    let (target, protocol) = match args.as_slice() {
        [flag, target] if flag == "--target" => (target.clone(), Protocol::Http1),
        [flag, target, p, name] if flag == "--target" && p == "--protocol" => {
            (target.clone(), Protocol::parse(name).unwrap_or_else(|| usage()))
        }
        _ => usage(),
    };
    let Some((host, port)) = target.rsplit_once(':').and_then(|(h, p)| p.parse::<u16>().ok().map(|p| (h.to_string(), p))) else {
        eprintln!("traffic-generator: --target is host:port, not {target}");
        std::process::exit(2);
    };
    let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().expect("a runtime");
    LocalSet::new().block_on(&runtime, run(host, port, protocol));
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompiledInstance {
    request: Request,
    label: String,
    accepted: Vec<u16>,
    body_bytes: Option<u64>,
}

#[derive(Deserialize)]
struct CompiledTest {
    instances: Vec<CompiledInstance>,
}

#[derive(Deserialize)]
struct Open {
    tests: Vec<CompiledTest>,
    workers: usize,
    connections: usize,
    /// The requests one connection carries at once, which is 1 over HTTP/1.1.
    #[serde(default = "one")]
    streams: usize,
}

fn one() -> usize {
    1
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PhaseCommand {
    rps: f64,
    settle: u64,
    total: u64,
    abort_drop_fraction: Option<f64>,
    window_seconds: f64,
}

async fn run(host: String, port: u16, protocol: Protocol) {
    let exchanger = Rc::new(Exchanger::new(host.clone(), port, protocol));
    let mut load: Option<Load> = None;
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let command: Value = match serde_json::from_str(&line) {
            Ok(command) => command,
            Err(e) => {
                say(&json!({ "kind": "error", "message": format!("a command that is not JSON: {e}") }));
                continue;
            }
        };
        match command["op"].as_str() {
            Some("exchange") => {
                let exchanger = exchanger.clone();
                tokio::task::spawn_local(async move {
                    let id = command["id"].clone();
                    let timeout = Duration::from_millis(command["timeoutMs"].as_u64().unwrap_or(10_000));
                    let answer = match serde_json::from_value::<Request>(command["request"].clone()) {
                        Ok(request) => exchanger.exchange(&request, timeout).await,
                        Err(e) => Err(format!("a request that does not parse: {e}")),
                    };
                    say(&match answer {
                        Ok(answer) => json!({ "id": id, "answer": answer }),
                        Err(error) => json!({ "id": id, "error": error }),
                    });
                });
            }
            Some("open") => {
                if let Some(open) = load.take() {
                    open.close();
                }
                match open(&host, port, protocol, &exchanger.authority(), command).await {
                    Ok(opened) => {
                        load = Some(opened);
                        say(&json!({ "kind": "ready" }));
                    }
                    Err(message) => say(&json!({ "kind": "error", "message": message })),
                }
            }
            Some("phase") => {
                let Some(running) = load.as_mut() else {
                    say(&json!({ "kind": "error", "message": "a phase before the load was opened" }));
                    continue;
                };
                let phase = match serde_json::from_value::<PhaseCommand>(command) {
                    Ok(phase) => phase,
                    Err(e) => {
                        say(&json!({ "kind": "error", "message": format!("a phase that does not parse: {e}") }));
                        continue;
                    }
                };
                let schedule = Schedule { rps: phase.rps, settle: phase.settle, total: phase.total, window_seconds: phase.window_seconds };
                match running.phase(schedule, phase.abort_drop_fraction).await {
                    Ok(phased) => say(&report(phased)),
                    Err(message) => say(&json!({ "kind": "error", "message": message })),
                }
            }
            Some("close") => {
                if let Some(open) = load.take() {
                    open.close();
                }
                say(&json!({ "kind": "closed" }));
            }
            other => say(&json!({ "kind": "error", "message": format!("{other:?} is not a command") })),
        }
    }
    if let Some(open) = load.take() {
        open.close();
    }
}

#[derive(Deserialize)]
struct LambdaOpen {
    tests: Vec<CompiledTest>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClosedPhase {
    settle_seconds: f64,
    seconds: f64,
    window_seconds: f64,
}

/// The Runtime API on `bind`, driven by the same lines as a target.
async fn run_lambda(bind: String) {
    let (env, port) = match lambda::listen(&bind).await {
        Ok(listening) => listening,
        Err(why) => {
            eprintln!("traffic-generator: {why}");
            std::process::exit(1);
        }
    };
    say(&json!({ "kind": "listening", "port": port }));
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let command: Value = match serde_json::from_str(&line) {
            Ok(command) => command,
            Err(e) => {
                say(&json!({ "kind": "error", "message": format!("a command that is not JSON: {e}") }));
                continue;
            }
        };
        let timeout = Duration::from_millis(command["timeoutMs"].as_u64().unwrap_or(10_000));
        match command["op"].as_str() {
            Some("init") => {
                let env = env.clone();
                tokio::task::spawn_local(async move {
                    say(&match env.init(timeout).await {
                        Ok(at) => json!({ "kind": "init", "at": nanos(at) }),
                        Err(message) => json!({ "kind": "error", "message": message }),
                    });
                });
            }
            Some("exchange") => {
                let env = env.clone();
                tokio::task::spawn_local(async move {
                    let id = command["id"].clone();
                    let answer = match serde_json::from_value::<Request>(command["request"].clone()) {
                        Ok(request) => env.exchange(&request, timeout).await,
                        Err(e) => Err(format!("a request that does not parse: {e}")),
                    };
                    say(&match answer {
                        Ok(answer) => json!({ "id": id, "answer": answer }),
                        Err(error) => json!({ "id": id, "error": error }),
                    });
                });
            }
            Some("open") => match events(command) {
                Ok(tests) => {
                    env.load(tests);
                    say(&json!({ "kind": "ready" }));
                }
                Err(message) => say(&json!({ "kind": "error", "message": message })),
            },
            Some("phase") => {
                let phase = match serde_json::from_value::<ClosedPhase>(command) {
                    Ok(phase) => phase,
                    Err(e) => {
                        say(&json!({ "kind": "error", "message": format!("a phase that does not parse: {e}") }));
                        continue;
                    }
                };
                let (settle, seconds) = (Duration::from_secs_f64(phase.settle_seconds), Duration::from_secs_f64(phase.seconds));
                let window = Duration::from_secs_f64(phase.window_seconds);
                say(&match env.phase(settle, seconds, window, nanos).await {
                    Ok(report) => report,
                    Err(message) => json!({ "kind": "error", "message": message }),
                });
            }
            Some("close") => say(&json!({ "kind": "closed" })),
            other => say(&json!({ "kind": "error", "message": format!("{other:?} is not a command") })),
        }
    }
}

/// Every instance built into the `/next` answer that carries its event, before anything is timed.
fn events(command: Value) -> Result<Vec<Vec<lambda::Instance>>, String> {
    let open: LambdaOpen = serde_json::from_value(command).map_err(|e| format!("a load that does not parse: {e}"))?;
    if open.tests.is_empty() || open.tests.iter().any(|t| t.instances.is_empty()) {
        return Err("a load needs a test, and each test an instance".into());
    }
    let mut tests = Vec::with_capacity(open.tests.len());
    for test in open.tests {
        let mut instances = Vec::with_capacity(test.instances.len());
        for i in test.instances {
            let body = i.request.body()?;
            let event = apigw::event(&i.request, body.as_deref());
            instances.push(lambda::Instance {
                answer: lambda::NextAnswer::new(&event),
                label: i.label,
                accepted: i.accepted,
                body_bytes: i.body_bytes,
                head: i.request.is_head(),
            });
        }
        tests.push(instances);
    }
    Ok(tests)
}

/// Every instance built into its bytes before any thread starts, so nothing is built while a
/// phase is timed.
async fn open(host: &str, port: u16, protocol: Protocol, authority: &str, command: Value) -> Result<Load, String> {
    let open: Open = serde_json::from_value(command).map_err(|e| format!("a load that does not parse: {e}"))?;
    if open.workers == 0 || open.connections == 0 || open.streams == 0 || open.tests.is_empty() {
        return Err("a load needs a worker, a connection, a stream and a test".into());
    }
    if protocol == Protocol::Http1 && open.streams != 1 {
        return Err("an HTTP/1.1 connection carries one request at a time".into());
    }
    let mut tests = Vec::with_capacity(open.tests.len());
    for test in open.tests {
        let mut instances = Vec::with_capacity(test.instances.len());
        for i in test.instances {
            let body = i.request.body()?;
            let wire = match protocol {
                Protocol::Http1 => Wire::Http1(http1(&i.request, body.as_deref(), authority)),
                Protocol::H2c => Wire::H2c(Box::new(Template::new(&i.request, body, authority)?)),
            };
            instances.push(Instance { wire, head: i.request.is_head(), label: i.label, accepted: i.accepted, body_bytes: i.body_bytes });
        }
        if instances.is_empty() {
            return Err("a test with no instance".into());
        }
        tests.push(Test { instances });
    }
    Load::open(host.to_string(), port, protocol, tests, open.workers, open.connections, open.streams).await
}

/// A phase's threads merged: every test's tally, the settle's, and when it started and ended.
fn report(phased: Phased) -> Value {
    let Phased { start, aborted, reports } = phased;
    let tests = reports.first().map_or(0, |r| r.tallies.len());
    let mut tallies: Vec<Tally> = (0..tests).map(|_| Tally::new()).collect();
    let mut settle = Tally::new();
    let mut unfinished = 0;
    let mut last: Option<Instant> = None;
    for report in &reports {
        for (into, from) in tallies.iter_mut().zip(&report.tallies) {
            into.merge(from);
        }
        settle.merge(&report.settle);
        unfinished += report.unfinished;
        last = last.max(report.last);
    }
    json!({
        "kind": "phase",
        "aborted": aborted,
        "start": nanos(start),
        "last": last.map_or(0, nanos),
        "unfinished": unfinished,
        "settle": settle.json(),
        "tests": tallies.iter().map(Tally::json).collect::<Vec<_>>(),
    })
}
