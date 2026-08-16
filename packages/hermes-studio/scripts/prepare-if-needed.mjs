#!/usr/bin/env node
/**
 * 原来的 prepare 是 `[ -d dist ] || npm run build`。
 * `[` 是 Unix shell 内建命令，Windows cmd 下不存在，会直接报
 * “'[' 不是内部或外部命令”，导致 npm install 走进意料之外的分支。
 * 这里用 Node 实现同样的语义，跨平台一致。
 *
 * 语义：dist 已存在就跳过；不存在才构建。
 * 开发环境不需要 dist（vite dev 直接读源码），想跳过整步可用：
 *   npm install --ignore-scripts
 */
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (existsSync(resolve(root, 'dist'))) {
  console.log('[prepare] dist 已存在，跳过构建');
  process.exit(0);
}

console.log('[prepare] dist 不存在，执行 npm run build');
try {
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
} catch {
  console.error(
    '\n[prepare] 构建失败。开发环境不需要 dist，可用 `npm install --ignore-scripts` 跳过本步；\n' +
    '          若要打包桌面端/发布，请先修复上面的构建错误。',
  );
  process.exit(1);
}
