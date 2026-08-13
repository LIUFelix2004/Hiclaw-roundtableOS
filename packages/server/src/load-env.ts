import dotenv from 'dotenv';
import path from 'path';

// 后端进程工作目录是 packages/server，dotenv 默认读 cwd/.env（该文件不存在）。
// 这里显式指向上两级（monorepo 根目录）的 .env，保证 OPENAI_API_KEY 等配置被正确加载。
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
