import Router from '@koa/router'

const backendUrl = () => String(process.env.HERMES_COMPETITION_BACKEND_URL || 'http://127.0.0.1:8648').replace(/\/$/, '')
export const competitionRoutes = new Router()

async function proxyStats(ctx: any, path = '') {
  if (String(process.env.HERMES_COMPETITION_MODE || '').toLowerCase() !== 'true' && process.env.HERMES_COMPETITION_MODE !== '1') {
    ctx.status = 404
    return
  }
  try {
    const response = await fetch(`${backendUrl()}/api/stats${path}`)
    ctx.status = response.status
    ctx.body = await response.json()
  } catch {
    ctx.status = 502
    ctx.body = { error: 'competition_backend_unavailable' }
  }
}

competitionRoutes.get('/api/competition/stats', ctx => proxyStats(ctx))
competitionRoutes.get('/api/competition/stats/:metric', ctx => proxyStats(ctx, `/${encodeURIComponent(ctx.params.metric)}`))
