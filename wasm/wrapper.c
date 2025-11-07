/*
 * wrapper.c
 * 一个非常小的示例，用于演示如何为浏览器构建一个能够被 JS 调用的简单 WASM 模块。
 * 该示例并不是完整的 C 编译器实现，而是提供一个可构建的占位 API：
 *   - run_code(const char* src) -> 返回指向 C 字符串的指针（调用端需要通过 free_buffer 释放）
 *   - free_buffer(char* p)
 *
 * 在真实场景中，你会把 tcc/clang 的部分代码编译进 wasm，并暴露更复杂的接口。
 */
#include <stdlib.h>
#include <string.h>
#include <emscripten/emscripten.h>

EMSCRIPTEN_KEEPALIVE
char* run_code(const char* src) {
    // 简单演示：返回一条确认信息并回显前 120 字符
    const char* header = "[WASM-runner placeholder]\nReceived source:\n";
    size_t len = strlen(header) + 1;
    size_t srcLen = src ? strlen(src) : 0;
    size_t copyLen = srcLen > 120 ? 120 : srcLen;
    len += copyLen + 4; // 额外空间
    char* out = (char*)malloc(len);
    if (!out) return NULL;
    strcpy(out, header);
    if (src && srcLen>0) {
        strncat(out, src, copyLen);
        if (srcLen > copyLen) strcat(out, "...\n");
    } else {
        strcat(out, "<no source provided>\n");
    }
    return out;
}

EMSCRIPTEN_KEEPALIVE
void free_buffer(char* p) {
    if (p) free(p);
}
