/// A first-in, first-out queue of DEPTH words of WIDTH bits, held in registers (DEPTH ≥ 2).
/// `push` stores `data_in` unless the queue is full; `pop` removes the oldest word, which is always
/// shown on `data_out`, unless the queue is empty. A push and a pop can happen in the same cycle.
module Fifo<WIDTH: int, DEPTH: int>(
  clk: clock,
  push: bit,
  data_in: bits<WIDTH>,
  pop: bit,
) -> (
  data_out: bits<WIDTH>,
  empty: bit,
  full: bit,
  count: bits<clog2(DEPTH + 1)>,
) {
  reg slots: [bits<WIDTH>; DEPTH] = [0; DEPTH]
  reg read_index: bits<clog2(DEPTH)> = 0
  reg write_index: bits<clog2(DEPTH)> = 0
  reg used: bits<clog2(DEPTH + 1)> = 0
  let is_empty: bit = used == 0
  let is_full: bit = used == DEPTH
  let do_push: bit = push && !is_full
  let do_pop: bit = pop && !is_empty

  for i in 0..DEPTH {
    next slots[i] = if do_push && write_index == i { data_in } else { slots[i] }
  }
  next write_index = if !do_push {
    write_index
  } else if write_index == DEPTH - 1 {
    0
  } else {
    write_index + 1
  }
  next read_index = if !do_pop {
    read_index
  } else if read_index == DEPTH - 1 {
    0
  } else {
    read_index + 1
  }
  next used = if do_push && !do_pop {
    used + 1
  } else if do_pop && !do_push {
    used - 1
  } else {
    used
  }
  data_out = slots[read_index]
  empty = is_empty
  full = is_full
  count = used
}

test "keeps the order" {
  let f = sim Fifo<8, 4>(push: 1, data_in: 10, pop: 0)
  expect f.empty
  step
  f.data_in = 20
  step
  f.data_in = 30
  step
  f.push = 0
  expect f.count == 3 && f.data_out == 10
  f.pop = 1
  step
  expect f.data_out == 20
  step
  expect f.data_out == 30
  step
  expect f.empty && f.count == 0
}

test "refuses to overflow" {
  let f = sim Fifo<4, 3>(push: 1, data_in: 0, pop: 0)
  for i in 0..5 {
    f.data_in = i
    step
  }
  expect f.full && f.count == 3 && f.data_out == 0
  f.push = 0
  f.pop = 1
  step 2
  expect f.data_out == 2
}
