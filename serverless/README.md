# 一键参赛提交（Serverless） / One-click Contest Submission (Serverless)

本目录提供了一个 Cloudflare Worker 示例（`cloudflare-worker.js`），用于接收前端提交并在你的 GitHub 仓库里代为创建分支/提交/PR，从而让参赛者“无需 GitHub 账号即可提交”。下方先给出中文启用指南，英文原文在后半部分。

## 如何启用（中文）

一图流：前端评测通过 → 把加密后的元数据+代码 POST 到你的 Worker → Worker 在仓库创建 `submissions/week-<n>/<handle>/solution.c` 并发起 PR → 你的现有 CI（校验+排名）继续工作。

### 1. 部署 Cloudflare Worker（几分钟）

1) 在 Cloudflare 控制台新建一个 Worker（或用 `wrangler`）。
2) 将 `serverless/cloudflare-worker.js` 的内容完整复制到 Worker 编辑器中并保存部署。
3) 在 Worker 的“Settings → Variables（环境变量）”里配置：
   - `REPO`：你的目标仓库，例如 `DanielHe666/c`
   - `BASE_BRANCH`：主分支名，例如 `main`
  - （可选，启用 v4 强加密）`SUBMIT_PRIVATE_KEY`：RSA 私钥（PKCS#8 PEM，供服务端解包对称密钥并解密 AES-GCM）
   - 认证（两选一，推荐 GitHub App）：
     - GitHub App：`GITHUB_APP_ID`、`GITHUB_INSTALLATION_ID`、`GITHUB_PRIVATE_KEY`（PEM）
     - 或者使用精细化权限的 `GITHUB_TOKEN`（PAT，授予 contents:write, pull_requests:write）

说明：示例 Worker 已内置 CORS 支持（OPTIONS 预检与 `Access-Control-Allow-*` 头），可直接被浏览器端 fetch 调用。

### 2. 拿到公开 URL

部署成功后你会得到一个地址，例如：

```
https://your-worker.example.workers.dev/submit
```

注：示例代码不强制路径名，根路径也可；建议固定成 `/submit` 便于管理。

### 3. 在前端启用“一键提交”

编辑仓库中的 `scripts/version.js`，设置全局配置：

```js
window.__CONFIG__ = {
  submitEndpoint: 'https://your-worker.example.workers.dev/submit',
  // 启用 v4 AES-GCM + 公钥包裹（推荐）：将服务端对应的 RSA 公钥(PEM, SPKI) 配置到此
  submitPublicKey: `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----\n`
};
```

保存提交后，前端在评测 AC 时会优先尝试向该地址 POST 提交；成功会显示“提交成功”并给出 PR 链接；失败会回退到原有的提交页（Fork/PR 或 Issue 备用）。

### 4. 安全与加固（重要）

- 推荐使用 GitHub App，而非 PAT；并将权限限制到目标仓库及最小权限集（contents:write, pull_requests:write）。
- Worker 层建议增加：
  - 速率限制（Rate limiting）
  - 人机验证（如 Cloudflare Turnstile）
  - 额外参数校验/签名（若需要更强的完整性保证）。v4 已使用 AES-GCM（带认证标签）+ 公钥包裹，对客户端篡改具备强抵抗；无需把私钥放到前端。
- 示例已限制代码大小为 64KB，并内置 CORS。
- 仓库侧已有校验工作流：路径规则、编译、预测排名、ready 标签与自动合并；匿名 handle（`anon`）路径会被拒绝。

### 5. 常见问题

- 浏览器报 CORS 错误：请确认 Worker 返回了 `Access-Control-Allow-Origin` 等头（示例已内置），以及允许 `POST, OPTIONS`。
- Worker 返回 405：用 `POST` 请求该地址；预检 `OPTIONS` 会返回 204。
- GitHub 权限不足或 401：检查 GitHub App 或 PAT 权限与仓库安装范围；日志会提示失败原因。
- 自动合并失败：仓库受保护策略需要人工 Review 或设置；工作流会在 PR 留言说明原因，人工合并即可。

---

## How it works (English)

- Front-end (index.html) sends the encrypted payload produced by `secureContestPayload` (version: 2/3/4).
- The Worker decrypts metadata (handle, challenge, bytes, ts), creates a branch/commit under `submissions/week-<n>/<handle>/solution.c`, and opens a PR.
- Your existing CI (`validate-submission.yml`, `compute-rank.yml`) handles validation and leaderboard updates.

## Deploy (Cloudflare Workers) (English)

1. Create a new Worker (via dashboard or `wrangler`), copy `cloudflare-worker.js` as the entry.
2. Configure environment variables (Settings → Variables):
   - `REPO`: e.g., `DanielHe666/c`
   - `BASE_BRANCH`: e.g., `main`
  - (Optional, enable v4 strong crypto) `SUBMIT_PRIVATE_KEY`: RSA private key (PKCS#8 PEM) used to unwrap AES key and decrypt AES-GCM bundle
   - Either provide `GITHUB_TOKEN` (fine-grained PAT with repo contents+pull requests), or set up a GitHub App and provide:
     - `GITHUB_APP_ID`
     - `GITHUB_INSTALLATION_ID`
     - `GITHUB_PRIVATE_KEY` (PEM)
3. Deploy and note the public URL, e.g., `https://your-worker.example.workers.dev/submit`.
4. Edit `scripts/version.js` to set:

```js
window.__CONFIG__ = {
  submitEndpoint: 'https://your-worker.example.workers.dev/submit',
  // Enable v4 AES-GCM + RSA-OAEP key wrapping: paste the server's RSA public key (PEM, SPKI)
  submitPublicKey: `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----\n`
};
```

## Front-end behavior (English)

- On AC, if `submitEndpoint` is configured, the page tries one-click submit first.
- On success, it shows a success message and (if available) a PR link.
- On failure or if not configured, it falls back to the manual submit page (fork/PR or Issue fallback).

## Security & Hardening (English)

- Prefer a GitHub App over PAT. Restrict the App to the target repo with minimal permissions (contents:write, pull_requests:write).
- Add rate-limiting and spam protection (e.g., Turnstile captcha) on the Worker.
- Enforce size limits (already 64KB) and basic validation.
- Consider signing payloads or adding a shared secret if you need stronger integrity checks.

## Notes (English)

- This sample is minimal and unfancy, intended to get you started quickly.
- If you use another provider (Vercel Functions, Netlify Functions, Fly.io, etc.), porting the logic is straightforward.
