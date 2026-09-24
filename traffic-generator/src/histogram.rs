//! Latency histograms in microseconds, laid out as histogram.ts lays them out, so summarize.ts
//! reads what this writes.

/// Each bucket is 2% wider than the one before it, so a percentile read off one is within 2%.
pub const GROWTH: f64 = 1.02;

/// 1.02^920 is about 80 seconds, and anything slower lands in the last bucket.
pub const BUCKETS: usize = 920;

pub fn bucket_of(us: f64) -> usize {
    if us <= 1.0 {
        return 0;
    }
    ((us.ln() / GROWTH.ln()).floor() as usize).min(BUCKETS - 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bucket_starts_at_growth_to_its_index() {
        assert_eq!(bucket_of(0.5), 0);
        assert_eq!(bucket_of(1.0), 0);
        assert_eq!(bucket_of(1.0201), 1);
        assert_eq!(bucket_of(100.0), 232);
        assert_eq!(bucket_of(1e12), BUCKETS - 1);
    }
}
