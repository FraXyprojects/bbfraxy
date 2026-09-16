## 2025-01-24 - Pre-compiled RegExp instances in tight render loops
**Learning:** Instantiating complex RegExp objects inside tight render loops (like line-by-line syntax highlighting) introduces significant GC pressure and compilation overhead (measured ~30x slowdown in isolated benchmark).
**Action:** Always extract static regular expressions outside of functions that are called repeatedly (like loops or render functions), especially for regex arrays used in text parsing or highlighting.
## 2025-01-20 - Optimize code preview rendering
**Learning:** String allocations and intermediate array chaining (`.map().join()`) in large text parsing blocks can create significant garbage collection pressure on the client-side.
**Action:** When manipulating and joining very large string arrays or rendering large files, use pre-allocated arrays (`new Array(len)`) and traditional `for` loops instead of chained functional methods to reduce memory thrashing and improve rendering speed.
## 2025-01-26 - String Concatenation vs Array.join()
**Learning:** Contrary to older JavaScript wisdom, using a pre-allocated array and `.join('')` for large code block generation is measurably slower and creates more GC overhead than standard string concatenation (`+=`) in modern JS engines used by this project.
**Action:** Use simple string concatenation with `+=` instead of `new Array(len)` and `.join('')` when dynamically generating very large HTML strings or parsing large files.

## 2025-01-26 - Avoid functional pipelines in hot loops
**Learning:** Functional string pipelines like `path.toLowerCase().split('/').some(...)` executed thousands of times during filtering cause significant GC thrashing due to intermediate string and array allocations.
**Action:** When filtering large arrays based on string patterns, always use a pre-compiled `RegExp` instead of splitting and chaining array methods.
## 2023-10-24 - String Replacement Optimization
**Learning:** Chained `.replaceAll()` calls on strings, and loops calling `.replaceAll()` repeatedly over an array of placeholders, cause significant performance bottlenecks due to multiple O(N) passes and memory reallocations.
**Action:** Always prefer a single-pass regex replacement using a pre-allocated/hoisted lookup object (`const ESCAPE_MAP = {...}`) or a single replacer function when handling multiple distinct token replacements. Ensure the lookup map is defined outside the replacer function to avoid constant reallocation during matching.
