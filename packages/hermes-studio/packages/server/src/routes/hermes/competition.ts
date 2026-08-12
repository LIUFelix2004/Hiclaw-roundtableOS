import Router from '@koa/router'

const backendUrl = () => String(process.env.HERMES_COMPETITION_BACKEND_URL || 'http://127.0.0.1:8648').replace(/\/$/, '')
export const competitionRoutes = new Router()

function isCompetitionEnabled() {
  const mode = String(process.env.HERMES_COMPETITION_MODE || '')
  return mode === '1' || mode.toLowerCase() === 'true'
}

async function proxyStats(ctx: any, path = '') {
  if (!isCompetitionEnabled()) { ctx.status = 404; return }
  try {
    const response = await fetch(`${backendUrl()}/api/stats${path}`)
    ctx.status = response.status
    ctx.body = await response.json()
  } catch {
    ctx.status = 502
    ctx.body = { error: 'competition_backend_unavailable' }
  }
}

async function aggregateStats(ctx: any) {
  if (!isCompetitionEnabled()) { ctx.status = 404; return }
  const base = backendUrl()
  try {
    const [tokensRes, healthRes] = await Promise.all([
      fetch(`${base}/api/stats/tokens`),
      fetch(`${base}/api/stats/health`),
    ])
    const tokens = await tokensRes.json() as { total?: number; byAgent?: Record<string, number> }
    const health = await healthRes.json() as { memoryRecords?: number; failures?: number }
    ctx.body = {
      tokens: tokens.byAgent || {},
      costs: {},
      latency: {},
      successRate: health.memoryRecords ? Math.max(0, 1 - (health.failures || 0) / health.memoryRecords) : 0,
      totalRuns: health.memoryRecords || 0,
    }
  } catch {
    ctx.status = 502
    ctx.body = { error: 'competition_backend_unavailable' }
  }
}

competitionRoutes.get('/api/competition/stats', ctx => aggregateStats(ctx))
competitionRoutes.get('/api/competition/stats/:metric', ctx => proxyStats(ctx, `/${encodeURIComponent(ctx.params.metric)}`))
