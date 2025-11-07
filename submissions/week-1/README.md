# Week 1 Submissions

- Create a folder named after your handle: `submissions/week-1/<handle>/`
- Put your solution as a single C source file. Preferred filename: `solution.c` (any `.c` is accepted; `solution.c` takes priority if multiple exist).
- Your program must read from stdin and write to stdout.
- No UB, no file I/O, no non-standard libs.
- After your PR is merged to `main`, CI will compute byte length (UTF-8) and update `competition/data/week-1.json` and `competition/data/total.json`.

Notes:
- We compute bytes via Node Buffer length (UTF-8), equivalent to `wc -c`.
- Tie-break: earlier commit time wins.
