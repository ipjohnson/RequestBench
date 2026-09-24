//! What a phase counts, per test, in one thread or merged across all of them.
use base64::Engine;
use serde_json::{Value, json};

use crate::histogram::{BUCKETS, bucket_of};

pub struct Tally {
    /// Instances timed into `hist`. A mismatched answer is timed as well as counted in `mismatch`.
    pub count: u64,
    pub errors: u64,
    pub mismatch: u64,
    /// Never sent, because the in-flight limit was reached at their scheduled moment.
    pub dropped: u64,
    pub hist: Vec<u32>,
    pub first_error: Option<String>,
    pub first_mismatch: Option<String>,
}

impl Tally {
    pub fn new() -> Self {
        Tally { count: 0, errors: 0, mismatch: 0, dropped: 0, hist: vec![0; BUCKETS], first_error: None, first_mismatch: None }
    }

    pub fn time(&mut self, us: f64) {
        self.hist[bucket_of(us)] += 1;
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
        for (into, n) in self.hist.iter_mut().zip(&from.hist) {
            *into += n;
        }
        if self.first_error.is_none() {
            self.first_error.clone_from(&from.first_error);
        }
        if self.first_mismatch.is_none() {
            self.first_mismatch.clone_from(&from.first_mismatch);
        }
    }

    /// The histogram as histogram.ts encodes one: the buckets as little-endian u32s, in base64.
    pub fn json(&self) -> Value {
        let bytes: Vec<u8> = self.hist.iter().flat_map(|n| n.to_le_bytes()).collect();
        json!({
            "count": self.count,
            "errors": self.errors,
            "mismatch": self.mismatch,
            "dropped": self.dropped,
            "hist": base64::engine::general_purpose::STANDARD.encode(bytes),
            "firstError": self.first_error,
            "firstMismatch": self.first_mismatch,
        })
    }
}
