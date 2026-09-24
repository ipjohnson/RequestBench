//! What a phase counts, per test, in one thread or merged across all of them.
use base64::Engine;
use serde_json::{Value, json};

use crate::histogram::{BUCKETS, bucket_of};

pub struct Tally {
    /// Instances timed into `hist` or a window. A mismatched answer is timed as well as counted in `mismatch`.
    pub count: u64,
    pub errors: u64,
    pub mismatch: u64,
    /// Never sent, because the in-flight limit was reached at their scheduled moment.
    pub dropped: u64,
    /// Every instance timed, when the tally has no windows, as the settle's has none.
    pub hist: Vec<u32>,
    /// The recording cut into stretches of equal length, a histogram for each. An instance is
    /// counted in one of these or in `hist`, never both, and `json` reports `hist` as the sum.
    pub windows: Vec<Vec<u32>>,
    pub first_error: Option<String>,
    pub first_mismatch: Option<String>,
}

fn add(into: &mut [u32], from: &[u32]) {
    for (into, n) in into.iter_mut().zip(from) {
        *into += n;
    }
}

/// A histogram as histogram.ts encodes one: the buckets as little-endian u32s, in base64.
fn encode(hist: &[u32]) -> String {
    let bytes: Vec<u8> = hist.iter().flat_map(|n| n.to_le_bytes()).collect();
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

impl Tally {
    pub fn new() -> Self {
        Tally::windowed(0)
    }

    /// A tally with its windows allocated, so none is allocated while a phase is timed.
    pub fn windowed(windows: usize) -> Self {
        Tally {
            count: 0,
            errors: 0,
            mismatch: 0,
            dropped: 0,
            hist: vec![0; BUCKETS],
            windows: vec![vec![0; BUCKETS]; windows],
            first_error: None,
            first_mismatch: None,
        }
    }

    /// `us` in window `window`, in the last window when it is past them, or in `hist` when the
    /// tally has none.
    pub fn time(&mut self, us: f64, window: usize) {
        let last = self.windows.len().saturating_sub(1);
        let hist = match self.windows.get_mut(window.min(last)) {
            Some(hist) => hist,
            None => &mut self.hist,
        };
        hist[bucket_of(us)] += 1;
        self.count += 1;
    }

    pub fn error(&mut self, why: &str) {
        self.errors += 1;
        if self.first_error.is_none() {
            self.first_error = Some(why.to_string());
        }
    }

    pub fn mismatched(&mut self, why: impl FnOnce() -> String) {
        self.mismatch += 1;
        if self.first_mismatch.is_none() {
            self.first_mismatch = Some(why());
        }
    }

    pub fn merge(&mut self, from: &Tally) {
        self.count += from.count;
        self.errors += from.errors;
        self.mismatch += from.mismatch;
        self.dropped += from.dropped;
        add(&mut self.hist, &from.hist);
        if self.windows.len() < from.windows.len() {
            self.windows.resize(from.windows.len(), vec![0; BUCKETS]);
        }
        for (into, from) in self.windows.iter_mut().zip(&from.windows) {
            add(into, from);
        }
        if self.first_error.is_none() {
            self.first_error.clone_from(&from.first_error);
        }
        if self.first_mismatch.is_none() {
            self.first_mismatch.clone_from(&from.first_mismatch);
        }
    }

    /// `hist` is every instance timed, whichever window holds it, and `windows` each window's own.
    pub fn json(&self) -> Value {
        let mut all = self.hist.clone();
        for window in &self.windows {
            add(&mut all, window);
        }
        json!({
            "count": self.count,
            "errors": self.errors,
            "mismatch": self.mismatch,
            "dropped": self.dropped,
            "hist": encode(&all),
            "windows": self.windows.iter().map(|w| encode(w)).collect::<Vec<_>>(),
            "firstError": self.first_error,
            "firstMismatch": self.first_mismatch,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_instance_counts_in_its_window_and_the_histogram_counts_every_window() {
        let mut t = Tally::windowed(2);
        t.time(100.0, 0);
        t.time(100.0, 1);
        // Past the last window, as an event that went out a moment after the phase ended is.
        t.time(100.0, 2);
        let mut merged = Tally::new();
        merged.merge(&t);
        let json = merged.json();
        let decode = |b64: &Value| -> u32 {
            let bytes = base64::engine::general_purpose::STANDARD.decode(b64.as_str().unwrap()).unwrap();
            let at = bucket_of(100.0) * 4;
            u32::from_le_bytes(bytes[at..at + 4].try_into().unwrap())
        };
        assert_eq!(json["count"], 3);
        assert_eq!(decode(&json["hist"]), 3);
        let windows = json["windows"].as_array().unwrap();
        assert_eq!((windows.len(), decode(&windows[0]), decode(&windows[1])), (2, 1, 2));
        assert_eq!(merged.hist.iter().sum::<u32>(), 0, "a windowed tally keeps nothing outside its windows");
    }
}
