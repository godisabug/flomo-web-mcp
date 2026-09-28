# flomo-web-mcp

`flomo-web-mcp` 是一个本地运行的 flomo MCP stdio server。它使用你自己的 flomo Web 登录态凭据，为支持 Model Context Protocol 的客户端提供 memo 读取、搜索、同步、随机漫游和新建能力。

> 本项目不是 flomo 官方项目。它依赖 flomo Web 的内部接口和会话凭据，接口可能变化；请只在你信任的本地环境中运行。

## 风险声明

使用本项目即表示你理解并接受以下风险：

- 本项目由社区开发者维护，不代表 flomo 官方，也不获得 flomo 官方背书或服务承诺。
- 本项目按“现状”提供，不保证持续可用、接口稳定、数据完整性或适配所有 MCP 客户端。
- 你需要自行确认使用方式符合 flomo 服务条款、所在地区法律法规和所在组织的安全要求。
- 你自行承担因使用本项目产生的账号异常、凭据泄露、数据丢失、请求失败、服务中断或第三方限制等风险。
- 在适用法律允许的最大范围内，项目开发者和贡献者不对上述风险造成的直接或间接损失承担责任。

## 功能

- 作为本地 stdio MCP server 运行，可接入支持 MCP 的客户端。
- 使用你的 flomo Web 会话凭据访问 memo，不需要 flomo Pro。
- 支持查看最近 memo、按 `slug` 获取单条 memo、随机漫游和创建新 memo。
- 支持分页同步 memo 到本地内存缓存，并在显式指定范围时执行全库搜索或定位。
- 保留 memo 的换行和富文本结构，并支持图片或附件-only memo 的文件 metadata。

## 运行流程

```mermaid
flowchart LR
  Host["MCP 客户端"] -->|启动 stdio server| Server["flomo-web-mcp"]
  Server -->|读取 env| Config["本地配置<br/>FLOMO_AUTHORIZATION 等"]
  Server -->|注册工具| Tools["MCP 工具<br/>list / sync / search / get / random / create"]
  Host -->|调用工具| Tools
  Tools -->|请求 flomo Web| Flomo["flomo Web 内部接口"]
  Flomo -->|返回 memo 数据| Parser["解析与错误映射"]
  Parser -->|返回 MCP 响应| Host
  Tools -->|sync_notes| Cache["本地内存缓存"]
  Cache -->|search_notes / get_note / random_note| Tools
```

## 要求

- Node.js 20.19.0 或更高版本。
- npm。
- 支持 stdio MCP server 的客户端。
- 你自己的 flomo Web 会话 `Authorization`，必要时还包括 `Cookie`。

## 安装

### 通过 npm 安装

```bash
npm install -g flomo-web-mcp
```

安装后 MCP server 命令为：

```bash
flomo-web-mcp
```

### 通过源码运行

```bash
git clone https://github.com/godisabug/flomo-web-mcp.git
cd flomo-web-mcp
npm install
npm run build
```

源码方式的运行入口是：

```bash
node dist/index.js
```

运行完整本地验证：

```bash
npm run verify
```

## 配置凭据

推荐在 MCP 客户端配置中通过 `env` 传入凭据。也可以复制 `.env.example` 为 `.env`，再填写本地凭据：

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

至少需要：

```dotenv
FLOMO_AUTHORIZATION=Bearer your-token-here
```

## MCP 客户端配置

### npm 全局安装

```json
{
  "mcpServers": {
    "flomo": {
      "command": "flomo-web-mcp",
      "args": [],
      "env": {
        "FLOMO_AUTHORIZATION": "Bearer your-token-here",
        "FLOMO_BASE_URL": "https://flomoapp.com",
        "FLOMO_WEB_BASE_URL": "https://v.flomoapp.com",
        "FLOMO_TIMEZONE": "Asia/Shanghai",
        "FLOMO_REQUEST_TIMEOUT_MS": "30000"
      }
    }
  }
}
```

### 源码构建运行

把 `args` 改成你本地项目的 `dist/index.js` 绝对路径：

```json
{
  "mcpServers": {
    "flomo": {
      "command": "node",
      "args": ["D:/Projects/flomo-web-mcp/dist/index.js"],
      "env": {
        "FLOMO_AUTHORIZATION": "Bearer your-token-here",
        "FLOMO_BASE_URL": "https://flomoapp.com",
        "FLOMO_WEB_BASE_URL": "https://v.flomoapp.com",
        "FLOMO_TIMEZONE": "Asia/Shanghai",
        "FLOMO_REQUEST_TIMEOUT_MS": "30000"
      }
    }
  }
}
```

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `FLOMO_AUTHORIZATION` | 读取/写入时必填 | 无 | flomo Web 请求中的 `Authorization` header。 |
| `FLOMO_COOKIE` | 可选 | 无 | flomo Web Cookie；只有当前接口要求时再填写。 |
| `FLOMO_USER_AGENT` | 可选 | `Mozilla/5.0` | 请求 flomo Web 时使用的 User-Agent。 |
| `FLOMO_BASE_URL` | 可选 | `https://flomoapp.com` | flomo API 基础地址。 |
| `FLOMO_WEB_BASE_URL` | 可选 | `https://v.flomoapp.com` | flomo Web 基础地址。 |
| `FLOMO_TIMEZONE` | 可选 | `Asia/Shanghai` | IANA timezone。 |
| `FLOMO_REQUEST_TIMEOUT_MS` | 可选 | `30000` | flomo Web 请求超时时间，单位毫秒。 |
| `LOG_LEVEL` | 可选 | `info` | `debug`、`info`、`warn` 或 `error`。 |
| `FLOMO_READ_ENDPOINT` | 可选 | 内置当前路径 | 仅在 flomo Web 内部读取路径变化时覆盖。 |
| `FLOMO_SYNC_ENDPOINT` | 可选 | 内置当前路径 | 仅在 flomo Web 内部同步路径变化时覆盖。 |
| `FLOMO_WRITE_ENDPOINT` | 可选 | 内置当前路径 | 仅在 flomo Web 内部写入路径变化时覆盖。 |

完整示例见 [.env.example](.env.example)。

## MCP 工具

| 工具 | 说明 |
| --- | --- |
| `ping` | 检查 server 是否可用。 |
| `list_notes` | 列出最近 memo。 |
| `sync_notes` | 分页同步 memo 到本地内存缓存，只返回同步统计。 |
| `search_notes` | 默认搜索最近 memo；传入 `scope: "all_synced_notes"` 时搜索已同步缓存。 |
| `get_note` | 默认按 `slug` 从最近 memo 定位；传入 `scope: "all_synced_notes"` 时从已同步缓存定位；传入 `includeHtml: true` 时额外返回原始富文本 HTML。 |
| `random_note` | 默认刷新全量 memo 后随机返回一条；支持 `tags`、`excludeTags` 和 `refresh: false`，刷新失败时回退当前会话缓存。 |
| `create_note` | 新建 memo。 |

工具返回紧凑 JSON。为节省上下文，memo 默认只返回保留了换行和列表结构的 `content`，不含原始 `html`。只读工具带有 `readOnlyHint` 标注，`create_note` 标注为非只读，便于 MCP 客户端决定是否需要确认。

## 全量同步边界

本项目不提供“一次性返回全部笔记正文”的工具。需要全库检索时，先调用 `sync_notes` 建立本地内存缓存，再用 `search_notes` 或 `get_note` 显式指定：

```json
{
  "scope": "all_synced_notes"
}
```

`sync_notes` 支持 `pageSize`（最大 200）和 `maxPages`（最大 100）。如果达到页数上限但仍可能有更多笔记，返回值中的 `complete` 会是 `false`。

`random_note` 默认会先执行全量同步，再从结果中随机选择一条 memo。可传入 `tags` 作为白名单、`excludeTags` 作为黑名单；父级 tag 会匹配其层级子 tag，黑名单优先。如果刷新失败但当前 server session 已有同步缓存，工具会从缓存中选择并在 `refresh` metadata 中说明回退；传入 `refresh: false` 可直接使用现有缓存。

```json
{
  "tags": ["work", "idea"],
  "excludeTags": ["private"],
  "refresh": false
}
```

该 Session Sync Cache 只存在于当前 server session，不是持久存储、备份或权威数据源。

## 相关项目

- [flomo-web-cli](https://github.com/godisabug/flomo-web-cli)：共享同一 flomo Core 行为的命令行形式，适合在终端或脚本里直接操作 flomo memo。
- `flomo-web-mcp`：当前项目，适合接入支持 Model Context Protocol 的客户端。

## 获取 Authorization

1. 使用 Edge 或 Chrome 登录 flomo Web，并打开 DevTools 的 Network。
2. 刷新页面，在 Fetch/XHR 请求中筛选 `/api/v1/memo/updated` 或其他 flomo memo 请求。
3. 打开请求，在 Request Headers 中复制完整的 `Authorization: Bearer ...` 值。
4. 将其写入 MCP 客户端配置或本地 `.env` 的 `FLOMO_AUTHORIZATION`；不要提交或分享该值。

## 安全提醒

- 不要把 `FLOMO_AUTHORIZATION`、`FLOMO_COOKIE`、原始 memo 内容或 flomo 响应日志提交到 Git。
- 不要把凭据发给第三方 MCP host、在线调试工具或公开 issue。
- 项目会对日志 metadata 中常见的 `authorization`、`cookie`、`token` 字段做脱敏，但这不能替代你对凭据和日志的主动保护。
- 如果 flomo Web 内部接口变化，可以临时覆盖 `FLOMO_READ_ENDPOINT`、`FLOMO_SYNC_ENDPOINT` 或 `FLOMO_WRITE_ENDPOINT`。

## 许可证

MIT，见 [LICENSE](LICENSE)。
