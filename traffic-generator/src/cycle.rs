//! The order a load sends its tests in: one cycle of slots, each naming a test, repeated for as
//! long as a phase runs. The TypeScript builds the cycle from each test's heft, so a heavy test
//! comes round less often than a light one, and every run is sent the same order.

/// A load's cycle, with each slot's place among its own test's slots.
pub struct Cycle {
    /// Each slot's test, and how many of that test's slots come before it in the cycle.
    slots: Vec<(usize, u64)>,
    /// Each test's slots in one cycle.
    calls: Vec<u64>,
}

impl Cycle {
    /// The cycle `order` lays out, a test's place in the load for each slot. Every test needs a slot.
    pub fn new(order: &[usize], tests: usize) -> Result<Cycle, String> {
        let mut calls = vec![0u64; tests];
        let mut slots = Vec::with_capacity(order.len());
        for &test in order {
            let Some(before) = calls.get_mut(test) else {
                return Err(format!("the order names test {test}, and the load has {tests}"));
            };
            slots.push((test, *before));
            *before += 1;
        }
        match calls.iter().position(|&n| n == 0) {
            Some(test) => Err(format!("the order never sends test {test}")),
            None => Ok(Cycle { slots, calls }),
        }
    }

    /// The test the `k`-th slot of a phase sends, and how many of that test's slots came before it
    /// in the phase, which is how its instances take turns.
    pub fn slot(&self, k: u64) -> (usize, u64) {
        let len = self.slots.len() as u64;
        let (test, before) = self.slots[(k % len) as usize];
        (test, k / len * self.calls[test] + before)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_slot_sends_the_test_the_order_names_and_counts_that_tests_turns_across_cycles() {
        let cycle = Cycle::new(&[0, 1, 0, 2, 0], 3).unwrap();
        let slots: Vec<(usize, u64)> = (0..10).map(|k| cycle.slot(k)).collect();
        assert_eq!(slots, [(0, 0), (1, 0), (0, 1), (2, 0), (0, 2), (0, 3), (1, 1), (0, 4), (2, 1), (0, 5)]);
    }

    #[test]
    fn an_order_that_names_a_test_the_load_lacks_or_leaves_one_out_is_refused() {
        assert_eq!(Cycle::new(&[0, 3], 2).err().as_deref(), Some("the order names test 3, and the load has 2"));
        assert_eq!(Cycle::new(&[0, 0], 2).err().as_deref(), Some("the order never sends test 1"));
    }
}
