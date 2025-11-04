/*
 * tcc_runner.js - WASM loader for the placeholder wrapper module
 * This loader will attempt to load a built Emscripten output at one of the
 * common locations (relative to the site root). If it fails, it keeps a
 * friendly `window.wasmRun` that returns a rejected Promise with a clear
 * error message so the UI can fallback to Wandbox or simulation.
 */
(function(){
    'use strict';

    function makeNotReady(message){
        return function(code, stdin){
            return Promise.reject(new Error(message));
        };
    }

    // Default not-ready implementation (will be overwritten on success)
    try { window.wasmRun = makeNotReady('WASM 运行器未部署：未找到可加载的 tcc_runner 模块。请构建并将产物放到 /wasm/dist/'); } catch(e){}

    // Try several candidate paths (absolute and relative) where dist may exist.
    const candidates = [
        '/wasm/dist/tcc_runner.js',
        'wasm/dist/tcc_runner.js',
        './wasm/dist/tcc_runner.js',
        '/projects/compiler/wasm/dist/tcc_runner.js'
    ];

    async function tryLoadScript(entry){
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = entry;
            s.async = true;
            s.onload = () => resolve(entry);
            s.onerror = (err) => reject(new Error('加载失败: ' + entry));
            document.head.appendChild(s);
        });
    }

    async function tryLoadDist(){
        for (const entry of candidates){
            try{
                console.debug('[tcc_runner] 尝试加载', entry);
                await tryLoadScript(entry);
                // If the script loaded but didn't expose createTccModule, continue
                if (typeof window.createTccModule !== 'function'){
                    console.warn('[tcc_runner] 脚本已加载但未找到 createTccModule() 导出，继续尝试下一个路径');
                    continue;
                }

                // Create module instance
                const moduleInstance = await window.createTccModule();
                if (!moduleInstance) throw new Error('createTccModule() 返回空实例');

                // Wrap C functions
                const run_code = moduleInstance.cwrap('run_code', 'number', ['string']);
                const free_buffer = moduleInstance.cwrap('free_buffer', null, ['number']);

                // Replace window.wasmRun with a working implementation
                window.wasmRun = function(code, stdin){
                    return new Promise((resolve, reject) => {
                        try{
                            const ptr = run_code(code || '');
                            if (!ptr) return resolve({ stdout: '', stderr: 'no output', exitCode: 0 });
                            const out = moduleInstance.UTF8ToString(ptr);
                            free_buffer(ptr);
                            resolve({ stdout: out, stderr: '', exitCode: 0 });
                        }catch(e){
                            reject(e);
                        }
                    });
                };

                console.info('[tcc_runner] WASM runner 已加载（from ' + entry + '）');
                return;
            }catch(e){
                console.debug('[tcc_runner] 无法从', entry, '加载运行器：', e && e.message);
                // try next candidate
            }
        }

        // If we exit loop, none succeeded — keep notReady implementation and log
        console.warn('[tcc_runner] 未能加载任何本地 WASM 运行器；页面将回退到 Wandbox 或本地模拟。要启用 WASM，请构建并将 dist 放到 /wasm/dist/');
        try { window.wasmRun = makeNotReady('WASM 运行器未部署：请将构建产物放到 /wasm/dist/ 或通过 CI 将其部署到站点。'); } catch(e){}
    }

    // Attempt to load after page load (non-blocking)
    try{
        if (document.readyState === 'complete' || document.readyState === 'interactive'){
            setTimeout(tryLoadDist, 200);
        } else {
            window.addEventListener('load', () => { setTimeout(tryLoadDist, 200); });
        }
    }catch(e){ tryLoadDist(); }

})();
