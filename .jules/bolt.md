## 2025-01-24 - Pre-compiled RegExp instances in tight render loops
**Learning:** Instantiating complex RegExp objects inside tight render loops (like line-by-line syntax highlighting) introduces significant GC pressure and compilation overhead (measured ~30x slowdown in isolated benchmark).
**Action:** Always extract static regular expressions outside of functions that are called repeatedly (like loops or render functions), especially for regex arrays used in text parsing or highlighting.
## 2025-01-20 - Optimize code preview rendering
**Learning:** String allocations and intermediate array chaining (`.map().join()`) in large text parsing blocks can create significant garbage collection pressure on the client-side.
**Action:** When manipulating and joining very large string arrays or rendering large files, use pre-allocated arrays (`new Array(len)`) and traditional `for` loops instead of chained functional methods to reduce memory thrashing and improve rendering speed.
