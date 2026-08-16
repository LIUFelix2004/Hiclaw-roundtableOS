import fs from 'node:fs';
import path from 'node:path';

/**
 * 加载 monorepo 根目录的 .env。
 *
 * bridge 由 `pnpm --filter @hermes/hiclaw-bridge start` 启动时，cwd 是
 * packages/hiclaw-bridge，而 .env 在仓库根目录。此前 bridge 完全没有加载
 * .env：用户把 HICLAW_* 填好了，进程里却一个都读不到，readMatrixConfig()
 * 返回 null，于是静默退回 mock —— 配置正确却进不了 live，且不报任何错。
 *
 * 用 Node 内置的 process.loadEnvFile（Node 20.12+ / 22+），不引入 dotenv 依赖，
 * 这样单文件补丁即可生效，无需改 package.json 或重新安装。
 * 向上查找而不是写死相对层级，避免换启动目录就失效。
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

if (!envPath) {
  console.log('[bridge] 未找到 .env，仅使用进程已有的环境变量');
} else {
  const loadEnvFile = (process as NodeJS.Process & {
    loadEnvFile?: (p: string) => void;
  }).loadEnvFile;

  if (typeof loadEnvFile === 'function') {
    // 已存在的环境变量优先：命令行显式传入的值不会被 .env 顶掉。
    const before = new Set(Object.keys(process.env));
    const snapshot = { ...process.env };
    try {
      loadEnvFile(envPath);
      for (const key of before) {
        if (snapshot[key] !== undefined) process.env[key] = snapshot[key];
      }
      console.log(`[bridge] 已加载环境变量: ${envPath}`);
    } catch (err) {
      console.warn(`[bridge] 加载 .env 失败: ${(err as Error).message}`);
    }
  } else {
    console.warn(
      `[bridge] 当前 Node (${process.version}) 不支持 process.loadEnvFile，` +
        '请升级到 Node 20.12+ / 22+，否则 .env 不会生效',
    );
  }
}
