# AgentTeams 凭据提取 — Codex 指令

> 目标：在**已部署 AgentTeams 的那台机器上**，机械地提取出 `AGENTTEAMS_ADMIN_PASSWORD`
> 与 `AGENTTEAMS_MANAGER_GATEWAY_KEY`，并落成 hermes-agentos 可用的本地环境配置。
> 上游依据：`github.com/agentscope-ai/AgentTeams`（下文行号均指该仓库）

---

## 零、先明确这个任务的边界

**你（Codex）无法「获取」凭据，只能「找到」它。** 这两个值不是去某个网站申请的 API key，
而是 `install/agentteams-install.sh` 在安装时**在本机生成**的随机串。所以：

- 如果这台机器（或你能访问的 k8s 集群）**装过** AgentTeams → 值一定存在，本文档能把它挖出来
- 如果**没装过** → 值不存在，任何搜索都是徒劳。**直接跳到第五节**，不要浪费时间乱翻

**先做这个判断**，再往下走：

```bash
# 探测：这台机器上有没有 AgentTeams 的痕迹
ls -la ~/agentteams-manager.env 2>/dev/null
docker ps -a --format '{{.Names}}' 2>/dev/null | grep -i agentteams
kubectl get ns 2>/dev/null | grep -i agentteams
```

三条全空 → 本机没装，去第五节。任意一条有输出 → 继续第二节。

---

## 一、安全红线（先读，违反即作废）

这两个值是**活的生产凭据**，`AGENTTEAMS_ADMIN_PASSWORD` 同时还是 MinIO 密码
（`install/agentteams-install.sh:3440`）和 Higress 控制台的 basic-auth 密码
（`manager/scripts/init/setup-higress.sh:152`）。泄露一个等于泄露三处。

1. **绝不把凭据值写进仓库任何被 git 跟踪的文件。** 只写 `.env.local`，且必须先确认它在
   `.gitignore` 里；不在就先加。
2. **绝不 `git add` / `git commit` 含凭据的文件。** 提交前跑 `git diff --cached` 自查。
3. **绝不把值打印到 PR 描述、commit message、issue、任何日志文件。**
   终端里必要的回显请**打码**：只显示前 4 位 + 长度，如 `a3f9…(32 chars)`。
4. 写完 `chmod 600 .env.local`。
5. 本文档产出的所有中间文件（探测脚本的输出等）用完即删，不要留在工作区。

**任务结束时向人类汇报的内容里，只能出现「找到了 / 没找到」和打码后的指纹，不能出现完整值。**

---

## 二、提取路径（按可靠性排序，命中即停）

### 路径 A · docker 安装的 env 文件（最常见，两个值都有）

安装脚本把两个值都写进同一个文件（`:3491` 写 ADMIN_PASSWORD，`:3509` 写
MANAGER_GATEWAY_KEY），路径默认 `~/agentteams-manager.env`，可被 `AGENTTEAMS_ENV_FILE` 覆盖。
脚本自己的读法在 `:3766`，照抄即可：

```bash
ENV_FILE="${AGENTTEAMS_ENV_FILE:-${HOME}/agentteams-manager.env}"
grep -E '^(AGENTTEAMS_ADMIN_PASSWORD|AGENTTEAMS_MANAGER_GATEWAY_KEY)=' "$ENV_FILE"
```

两个都拿到 → 直接去第三节。

### 路径 B · 运行中的 manager 容器（k8s 场景下的唯一可靠来源）

**这条路径不是备选，是 k8s 部署下的必经之路。** 原因：

`helm/agentteams/templates/secrets/runtime-env.yaml` 里**没有** `AGENTTEAMS_MANAGER_GATEWAY_KEY`
（我核实过，该 Secret 只含 ADMIN_PASSWORD / REGISTRATION_TOKEN / LLM_API_KEY /
APPSERVICE tokens）。而 `manager/scripts/init/start-manager-agent.sh:142-144`：

```sh
if [ -z "${AGENTTEAMS_MANAGER_GATEWAY_KEY}" ]; then
    export AGENTTEAMS_MANAGER_GATEWAY_KEY="$(generateKey 32)"
    log "Auto-generated AGENTTEAMS_MANAGER_GATEWAY_KEY"
fi
```

即 manager 容器启动时若没被注入就**自己生成**。所以活的值只在容器的进程环境里，
任何 Secret / ConfigMap 都查不到。

docker：

```bash
# 容器名固定为 agentteams-manager（install:4239）
docker inspect agentteams-manager \
  --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E 'AGENTTEAMS_(ADMIN_PASSWORD|MANAGER_GATEWAY_KEY)='
```

注意 `docker inspect` 读的是**创建时**的 env（来自 `--env-file`，install:4240）。
若值是容器内自生成的，`inspect` 看不到，必须进容器：

```bash
docker exec agentteams-manager printenv AGENTTEAMS_MANAGER_GATEWAY_KEY
docker exec agentteams-manager printenv AGENTTEAMS_ADMIN_PASSWORD
```

k8s：

```bash
NS=<agentteams 所在 namespace>
POD=$(kubectl -n "$NS" get pod -l app.kubernetes.io/component=manager \
      -o jsonpath='{.items[0].metadata.name}')
kubectl -n "$NS" exec "$POD" -- printenv AGENTTEAMS_MANAGER_GATEWAY_KEY
kubectl -n "$NS" exec "$POD" -- printenv AGENTTEAMS_ADMIN_PASSWORD
```

label selector 不确定时先 `kubectl -n "$NS" get pod` 肉眼找 manager pod。

### 路径 C · k8s Secret（只能拿到 ADMIN_PASSWORD）

Secret 名是 `{release-name}-agentteams-runtime-env`
（`helm/agentteams/templates/_helpers.tpl:79` 的 `agentteams.secretName`），
namespace 默认为 release namespace（`values.yaml:9`）。

```bash
NS=<namespace>
SECRET=$(kubectl -n "$NS" get secret -o name | grep runtime-env | head -1)
kubectl -n "$NS" get "$SECRET" -o jsonpath='{.data.AGENTTEAMS_ADMIN_PASSWORD}' | base64 -d; echo
```

**别在这里找 gateway key，它不在这个 Secret 里**（见路径 B 的解释）。

### 路径 D · Higress 已注册的 consumer（gateway key 的交叉验证）

安装时把 key 注册成了名为 `manager` 的 key-auth consumer
（`manager/scripts/init/setup-higress.sh:127-128`，`source: "BEARER"`），
AI 路由只放行 `allowedConsumers: ["manager"]`（同文件 `:248`）。

如果路径 A/B 拿到了值，用这条**验证**它确实是被网关认的那个（见第四节）。
如果路径 A/B 都失败，可以从 Higress 控制台的 consumer 配置里反查——
控制台地址与 basic-auth 见安装结束时的输出（`install:4330`），
账号是 `AGENTTEAMS_ADMIN_USER`（默认 `admin`）+ ADMIN_PASSWORD。
**这形成循环依赖**：没有 ADMIN_PASSWORD 就进不了控制台。所以这条只作交叉验证，不作主路径。

### 路径 E · Worker 凭据目录（旁证）

`agentteams-controller/internal/config/config.go:487` → `AGENTTEAMS_CREDS_DIR`
默认 `/data/worker-creds`，格式 `{name}.env`
（`internal/service/credentials.go:48-50`）；k8s 下也可能是
Secret `agentteams-creds-{workerName}`（`:165,180`）。

这里放的是 **Worker 自己的** Matrix 账号密码，**不是** admin 密码，
也不是 gateway key。对本次任务没有直接价值，但如果第五节要重装，
这里能确认哪些 Worker 已注册过。**不要**把 Worker 凭据误当成 admin 凭据交上去。

---

## 三、落地到 hermes-agentos

拿到两个值后，在仓库根目录写 `.env.local`（**不是** `.env.example`，那个是模板且被跟踪）：

```bash
# 1. 先确认 .gitignore 覆盖了它，没有就加上
grep -q '^\.env\.local$' .gitignore || echo '.env.local' >> .gitignore

# 2. 写入（用 heredoc，避免值出现在 shell history 里）
cat > .env.local <<'EOF'
HICLAW_GATEWAY_KEY=<AGENTTEAMS_MANAGER_GATEWAY_KEY 的值>
HICLAW_GATEWAY_BASE_URL=http://127.0.0.1:18080/v1
AGENTTEAMS_ADMIN_PASSWORD=<ADMIN_PASSWORD 的值>
EOF

chmod 600 .env.local
```

**名称映射（重要，不要搞混）**：

| 本仓库 | 上游 | 说明 |
|---|---|---|
| `HICLAW_GATEWAY_KEY` | `AGENTTEAMS_MANAGER_GATEWAY_KEY` | 同一个值，1:1 |
| `AGENTTEAMS_ADMIN_PASSWORD` | 同名 | 同一个值 |

`packages/orchestrator/src/llm.ts:40` 读 `HICLAW_GATEWAY_KEY`，
`gatewayChat()` 发的是 `Authorization: Bearer ${key}`，
与 Higress consumer 的 `source: "BEARER"` 天然对齐，**不需要改任何代码**。

若网关端口不是默认的 18080，从 env 文件里的 `AGENTTEAMS_PORT_GATEWAY` 取，
相应改 `HICLAW_GATEWAY_BASE_URL`。

---

## 四、验证（必做，不接受「文件写了就算完」）

### 4.1 gateway key 真的被网关认

```bash
source .env.local
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST "${HICLAW_GATEWAY_BASE_URL}/chat/completions" \
  -H "Authorization: Bearer ${HICLAW_GATEWAY_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"model":"deepseek-v4-pro","messages":[{"role":"user","content":"ping"}],"max_tokens":8}'
```

- `200` → 成功
- `401` / `403` → key 不对，或没注册成 `manager` consumer。**回到路径 B**，
  优先用 `docker exec printenv` 取容器内的活值（很可能是自生成的，与 env 文件里的不一致）
- 连不上 → 端口或 base URL 不对，核对 `AGENTTEAMS_PORT_GATEWAY`

### 4.2 orchestrator 真的走了网关，不是静默 mock

**这一步绝对不能跳。** `packages/orchestrator/src/llm.ts:45-47`：

```ts
export function isGatewayMockEnabled(): boolean {
  return process.env.MOCK_LLM === '1' || !gatewayApiKey();
}
```

key 为空时**不报错、不告警**，直接回退离线兜底数据。界面照常滚动、照常出结果，
看起来完全正常但一个真实调用都没发生。所以配完必须验证：

- 确认 `MOCK_LLM` **没有**被设成 `1`（`.env.example` 里默认是 `MOCK_LLM=1`，
  如果你的 `.env` 继承了它，会盖掉一切努力）
- 启动 orchestrator，观察日志里有没有真实的 `/v1/chat/completions` 出站请求
- 或临时把 `HICLAW_GATEWAY_BASE_URL` 指向一个不存在的端口，**确认会报错**——
  如果照样出结果，说明你还在 mock 里

### 4.3 admin 密码可用

用 `AGENTTEAMS_ADMIN_USER`（默认 `admin`）+ 密码登录 Higress 控制台
（端口取 env 文件里的 `AGENTTEAMS_PORT_CONSOLE`）。能登进去即验证通过。

---

## 五、如果本机根本没装 AgentTeams

**不要继续搜索，值不存在。** 两个选择，向人类汇报并让他们选：

**选择 1（推荐）：找装过的那台机器。** 凭据在队友/服务器上跑安装脚本的那台机器的
`~/agentteams-manager.env` 里，安装结束时也在屏幕上黄色高亮打印过
（`install:4303`、`:4330`）。让持有者在那台机器上跑第二节的路径 A，
把两个值通过**安全渠道**（不是 IM 明文、不是 git）传过来。

**选择 2：本机装一套。** 值会当场生成：

```bash
git clone https://github.com/agentscope-ai/AgentTeams.git
cd AgentTeams
# 可以预设，也可以留空让脚本自动生成
export AGENTTEAMS_ADMIN_PASSWORD=<至少 8 位>      # 留空则自动生成 admin$(openssl rand -hex 6)
bash install/agentteams-install.sh
```

装完后凭据在 `~/agentteams-manager.env`，回到第三节。
**注意**：这会在本机拉起 Matrix homeserver、Higress、MinIO 等一整套服务，占用较多资源，
且需要 docker/podman。装之前先确认人类同意。

---

## 六、交付

向人类汇报，**只报以下内容，不含完整凭据值**：

1. 走通的是哪条路径（A/B/C/D/E 或第五节）
2. 两个值的打码指纹：`前4位…(长度)`，例如 `HICLAW_GATEWAY_KEY = a3f9…(32 chars)`
3. 4.1 / 4.2 / 4.3 三项验证的实际结果（HTTP 码、日志片段）
4. `git status` 输出，证明 `.env.local` 处于 untracked/ignored 状态、没有被 add

**不要提交任何东西到 git。** 本任务唯一的产出是一个本地未跟踪文件
和一份汇报。若中途因为其他原因需要改代码，另开分支单独提交，
且改动里不得包含任何凭据值。
