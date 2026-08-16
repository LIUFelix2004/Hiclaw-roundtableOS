#!/usr/bin/env node
/**
 * 一条命令拉起比赛形态的完整链路：
 *
 *   hiclaw-bridge (8650)  ←  studio BFF (8647)  ←  studio 前端 (8649)
 *
 * 用法：
 *   pnpm demo              # mock 模式，不依赖网络与模型 Key
 *   pnpm demo --live       # 真实 hiclaw 链路（需先在 .env 配好 HICLAW_MATRIX_*）
 *
 * Ctrl+C 一次性关掉所有子进程。
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import http from 'node:http';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = process.argv.includes('--live');
const isWin = process.platform === 'win32';

const BRIDGE_PORT = Number(process.env.HICLAW_BRIDGE_PORT || 8650);
const BFF_PORT = 8647;
const WEB_PORT = 8649;

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
};

// 判断服务是否真正可用：发一个真实 HTTP 请求，而不是试图占用端口。
// Windows 允许在别的进程监听 0.0.0.0:PORT 时再绑定 127.0.0.1:PORT，
// 因此 portBusy() 在 Windows 上会把「已就绪」误判为「未就绪」。
function httpAlive(port, timeout = 2000) {
  return new Promise((res) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout }, (r) => {
      r.resume();
      res(true);
    });
    req.on('error', () => res(false));
    req.on('timeout', () => { req.destroy(); res(false); });
  });
}

const children = [];
function run(name, color, cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    cwd: opts.cwd || ROOT,
    env: { ...process.env, ...opts.env },
    shell: isWin, // Windows 上 pnpm/npm 是 .cmd，必须走 shell
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);

  const tag = `${color}[${name}]${C.reset} `;
  const pipe = (stream) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) process.stdout.write(tag + line + '\n');
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    process.stdout.write(`${tag}${C.red}进程退出 code=${code} signal=${signal}${C.reset}\n`);
  });
  return child;
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write(`\n${C.dim}正在关闭所有服务...${C.reset}\n`);
  for (const c of children) {
    try {
      if (isWin) spawn('taskkill', ['/pid', String(c.pid), '/f', '/t']);
      else process.kill(-c.pid, 'SIGTERM');
    } catch {
      try { c.kill('SIGTERM'); } catch { /* 已退出 */ }
    }
  }
  setTimeout(() => process.exit(0), 800);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const main = async () => {
  for (const [port, who] of [[BRIDGE_PORT, 'hiclaw-bridge'], [BFF_PORT, 'studio BFF'], [WEB_PORT, 'studio 前端']]) {
    if (await httpAlive(port, 1200)) {
      console.error(`${C.red}端口 ${port}（${who}）上已有服务在跑${C.reset}，请先关掉它再试。`);
      process.exit(1);
    }
  }

  console.log(`${C.bold}Hiclaw RoundtableOS — 比赛形态${C.reset}`);
  console.log(`${C.dim}模式: ${LIVE ? 'live（真实 hiclaw 链路）' : 'mock（离线演示数据）'}${C.reset}\n`);

  run('bridge', C.cyan, isWin ? 'pnpm' : 'pnpm',
    ['--filter', '@hermes/hiclaw-bridge', 'start'],
    { env: LIVE ? {} : { MOCK_LLM: '1' } });

  run('studio', C.green, 'npm', ['run', 'dev'], {
    cwd: resolve(ROOT, 'packages/hermes-studio'),
    env: {
      HERMES_COMPETITION_MODE: '1',
      HERMES_COMPETITION_BACKEND_URL: `http://127.0.0.1:${BRIDGE_PORT}`,
    },
  });

  // 等前端真正起来再打印入口，避免用户过早打开看到连接失败
  const started = Date.now();
  const poll = setInterval(async () => {
    if (shuttingDown) return clearInterval(poll);
    if (!(await httpAlive(WEB_PORT))) {
      if (Date.now() - started > 120_000) {
        clearInterval(poll);
        console.log(`\n${C.yellow}前端 120s 内未就绪，请查看上面的 [studio] 日志。${C.reset}`);
      }
      return;
    }
    clearInterval(poll);
    console.log(
      `\n${C.green}${C.bold}  ➜  打开 http://localhost:${WEB_PORT}${C.reset}` +
      `\n${C.dim}     左侧「AI 圆桌」→ 输入议题 → 发起圆桌${C.reset}` +
      `\n${C.dim}     bridge :${BRIDGE_PORT}   BFF :${BFF_PORT}   前端 :${WEB_PORT}   Ctrl+C 退出${C.reset}\n`,
    );
  }, 1500);
};

main().catch((err) => {
  console.error(err);
  shutdown();
});
