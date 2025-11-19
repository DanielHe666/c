# 在线 C 语言编译器开发流程

## 目标与定位
- 打造一个零后端依赖、开箱即用的 C 语言在线编译练习环境。
- 面向初学者和社团成员，强调低门槛、可分享、可离线访问的体验。
- 部署在 GitHub Pages，保证零成本运维以及版本可追踪。

## 阶段一：搭建基础骨架
1. **准备静态页面结构**：创建 `index.html`，划分头部信息栏、编辑器区域、侧栏输出区、底部工具栏。
2. **引入样式与图标**：使用自定义 CSS，结合 Font Awesome CDN 提供的图标；预留暗/明主题变量。
3. **加载 Monaco Loader**：通过 CDN 配置 `require.config({ paths: { vs: '.../monaco-editor/0.33.0/min/vs' } })`，为后续编辑器初始化铺路。
4. **知识储备**：熟悉 HTML 语义化、Flexbox 布局、Monaco 官方快速上手指南。

## 阶段二：集成 Monaco Editor
1. **初始化编辑器**：在 `require(['vs/editor/editor.main'], callback)` 中创建 `monaco.editor.create(...)`，设置语言 `c`、关闭 minimap、启用 `automaticLayout`。
2. **主题切换**：设计暗/明主题按钮，通过切换 `<body>` class 与 `monaco.editor.setTheme` 让编辑器与页面同步变换。
3. **键盘快捷键**：用 `window.editor.trigger` 绑定 Ctrl+Enter 运行、Ctrl+S 另存为、Ctrl+I 自动缩进等操作。
4. **知识储备**：了解 Monaco API（模型、命令、布局）和常见事件（`onDidChangeModelContent`）。

## 阶段三：实现代码运行链路
1. **接入 Wandbox API**：编写 `tryWandboxCompile`，通过 `fetch` POST 代码、编译器名、stdin，并设置 8~10 秒超时。
2. **结果展示**：解析返回的 stdout、stderr、退出码，在输出面板统一展示；失败时捕获异常并显示真实错误信息。
3. **测试面板**：新增测试用例存储结构，循环调用 Wandbox 批量校验，给出 PASS/FAIL 统计。
4. **知识储备**：HTTP 基础（POST、超时处理、CORS）、async/await、Promise.race。

## 阶段四：本地持久化与分享
1. **localStorage 管理**：将代码内容、主题、测试用例等分别持久化，页面加载时尝试恢复。
2. **分享链接**：编写 `buildShareUrl`，把代码、stdin、cases 序列化为 JSON 再 Base64 编码写入 `location.hash`。
3. **恢复逻辑**：在页面加载时解析 `#share=` 或旧版 `#code=`，还原编辑器状态并更新文件名显示。
4. **知识储备**：localStorage API、Base64 编码、URL hash 解析、JSON 序列化技巧。

## 阶段五：工具栏与增强功能
1. **自动缩进**：实现 `smartCIndent` 状态机，处理 `{}`、`case/default`、`do...while`、注释与字符串，按钮触发时重写编辑器文本。
2. **命令面板**：参考 VS Code 体验，封装命令数组与筛选逻辑，监听 Ctrl+Shift+P 打开。
3. **代码度量**：新增弹窗分析总行数、函数估算、圈复杂度等，帮助用户了解代码规模。
4. **I18n 支持**：维护中英文词典，切换按钮时刷新所有文本与提示。
5. **知识储备**：字符串处理、正则表达式、事件监听、UX 细节设计。

## 阶段六：PWA 与服务体验
1. **Service Worker**：编写 `sw.js`，安装阶段预缓存首页、manifest、图片，fetch 时采用 cache-first + 网络回源策略。
2. **版本控制**：在 `scripts/version.js` 暴露 `window.__VERSION__`，用于显示版本号并触发缓存更新。
3. **离线提示**：监听 `online/offline` 事件，更新状态徽章，断网时弹出提示告知无法编译。
4. **知识储备**：Service Worker 生命周期、缓存策略、PWA manifest 基础。

## 阶段七：部署与运维
1. **部署流程**：直接将静态资源推送至 GitHub 仓库 `main` 分支，GitHub Pages 自动生成公开站点。
2. **版本迭代**：通过 commit 记录功能变更，更新 `__VERSION__` 和 `sw.js` 中的 cache key。
3. **监控反馈**：收集团队反馈（执行超时、链接过长等），排期修复或准备备用编译服务方案。
4. **知识储备**：Git 基础、GitHub Pages 配置、浏览器缓存失效策略。

## 进一步的学习与优化方向
- 调研备用编译后端（如云函数 + Docker 沙箱），增强可用性。
- 支持多文件或模板项目，探索虚拟文件系统与打包结果的展示。
- 优化分享链接长度（引入 LZ 压缩或短链服务），提升社交平台传播体验。
- 引入自动化测试（Playwright/Puppeteer）验证核心功能。
- 将部分公共逻辑拆分为可复用模块，为后续 TypeScript 重构做铺垫。
