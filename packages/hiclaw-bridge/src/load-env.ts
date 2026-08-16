import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * 加载 monorepo 根目录的 .env。
 *
 * bridge 由 `pnpm --filter @hermes/hiclaw-bridge start` 启动时，cwd 是
 * packages/hiclaw-bridge，dotenv 默认读 cwd/.env（不存在）。此前 bridge 完全
 * 没有加载 .env：用户把 HICLAW_* 填好了，进程里却一个都读不到，于是静默退回
 * mock —— 这类失败最难排查，所以这里向上查找而不是写死相对层级。
 *
 * 已存在的环境变量优先（dotenv 默认不覆盖），命令行显式传入的值不会被 .env 顶掉。
 */
function findEnvFile(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const envPath = findEnvFile(process.cwd());

if (envPath) {
  dotenv.config({ path: envPath });
  console.log(`[bridge] 已加载环境变量: ${envPath}`);
} else {
  console.log('[bridge] 未找到 .env，仅使用进程已有的环境变量');
}
