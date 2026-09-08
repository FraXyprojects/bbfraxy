## 2025-01-24 - Pre-compiled RegExp instances in tight render loops
**Learning:** Instantiating complex RegExp objects inside tight render loops (like line-by-line syntax highlighting) introduces significant GC pressure and compilation overhead (measured ~30x slowdown in isolated benchmark).
**Action:** Always extract static regular expressions outside of functions that are called repeatedly (like loops or render functions), especially for regex arrays used in text parsing or highlighting.
