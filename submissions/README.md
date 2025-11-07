# Submissions Guide / 提交指南

## Structure / 目录结构
```
submissions/
  week-1/
    <handle>/
      solution.c (or any .c file)
  week-2/ (future)
    <handle>/
      solution.c
```

## Steps (EN)
1. Fork this repository.
2. Create your handle folder under `submissions/week-1/` (e.g. `submissions/week-1/alice/`).
3. Add a single C source file (`solution.c` preferred). Must read from stdin and write to stdout.
4. Open a Pull Request to `main`.
5. After merge, CI updates JSON leaderboards: `competition/data/week-1.json` and `competition/data/total.json`.
6. Update by overwriting the same file; earliest commit time used for tie-break.

## 步骤 (ZH)
1. Fork 本仓库。
2. 在 `submissions/week-1/` 下新建以自己昵称命名的目录，例如 `submissions/week-1/alice/`。
3. 添加一个 C 源文件（推荐命名 `solution.c`），程序需从标准输入读取并向标准输出打印结果。
4. 发起 PR 到 `main`。
5. 合并后 CI 会更新排行榜 JSON：`competition/data/week-1.json` 与 `competition/data/total.json`。
6. 通过覆盖同一路径文件来更新提交；相同字节数时按提交时间先后排名。

## Rules / 规则
- One `.c` file counted; `solution.c` has priority if multiple.
- UTF-8 byte length for ranking (`wc -c`).
- No undefined behavior, no file I/O, no non‑standard libraries.
- Standard headers allowed.

## Future Weeks / 未来周次
When week-2 starts, create `submissions/week-2/<handle>/solution.c`. Script can be extended with `WEEK='1,2'`.
