---
number: D
title: The bug museum
summary: Historic failures, and where the course re-enacts each one with its own tools.
---

Every exhibit in this museum is a real failure: a published algorithm that was wrong, a chip that divided badly, a rocket that was lost. Most of them are re-enacted in the course. The chapter named on the card gives you the system, as a Vouch model or program, and one of the course’s engines finds the bug. Re-enactments are simplified, and each card says how. When an exercise catches a bug, the card is stamped *caught* in this browser.

The exhibits are failures of very different kinds: a race between threads, an overflow, a missing table entry, a broken invariant, an attacker. They have one thing in common. Each failure was reachable from some input, schedule or message order that nobody had tried, and each one can be found by a tool that checks all of them.

::museum-gallery
