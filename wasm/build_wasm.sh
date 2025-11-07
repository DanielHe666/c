#!/usr/bin/env bash
set -euo pipefail

# build_wasm.sh
# 简单示例：使用 Emscripten 编译上面的 wrapper.c 为可在浏览器中加载的模块。
# 要求：已安装 emscripten（emcc）。

OUT_DIR="./dist"
mkdir -p "$OUT_DIR"

echo "Building WASM module (placeholder wrapper)..."

# 生成一个模块：tcc_runner.js + tcc_runner.wasm
# 使用 MODULARIZE=1 和 EXPORT_NAME 以便通过 createModule() 创建实例
emcc wrapper.c -O2 -s WASM=1 -s MODULARIZE=1 -s "EXPORT_NAME='createTccModule'" \
    -s EXPORTED_FUNCTIONS='["_run_code","_free_buffer"]' \
    -o "$OUT_DIR/tcc_runner.js"

echo "Build finished. Artifacts in $OUT_DIR"

echo "Note: this is a placeholder runner. For a real in-browser compiler you would compile the compiler sources (tcc/clang)
and expose appropriate APIs for compile/run and capturing stdout/stderr."
