import { connectDB, disconnectDB } from './config/configdb.js'
import authRoutes from './routes/authRoutes.js'
import productsRoutes from './routes/productsRoutes.js'
import cartRoutes from './routes/cartRouters.js'
import express from 'express'
import dotenv from 'dotenv'
import orderRoutes from './routes/orderRoutes.js'
import webhookRoutes from './routes/webhookRoutes.js'
import cors from 'cors'
import cookieParser from 'cookie-parser'

dotenv.config()

const app = express()

// Vercel envía la IP real del visitante mediante su proxy.
app.set('trust proxy', 1)

const PORT = 3001

app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'Cookie',
            'Set-Cookie',
        ],
        credentials: true,
    })
)
app.use(cookieParser())
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/products', productsRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/webhook', webhookRoutes)

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)
        })
    })
    .catch(() => {
        disconnectDB()
    })
