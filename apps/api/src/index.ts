import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authRoutes } from './routes/auth.ts'

const app = new Hono()

const corsOrigins = (process.env.CORS_ORIGINS ?? '')
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean)

app.use(
	'*',
	cors({
		origin: corsOrigins.length > 0 ? corsOrigins : [],
	}),
)

app.route('/auth', authRoutes)

app.get('/', (c) => c.text(String(Math.floor(Math.random() * 1_000_000))))

const port = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`API listening on http://localhost:${info.port}`)
})
