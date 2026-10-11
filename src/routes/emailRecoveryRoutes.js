import express from 'express'
import crypto from 'node:crypto'

import emailRecoveryController from '../controllers/emailRecoveryController.js'

const safeCompare = (received, expected) => {
    if (
        typeof received !== 'string' ||
        typeof expected !== 'string' ||
        !received ||
        !expected
    ) {
        return false
    }

    const receivedBuffer = Buffer.from(received)
    const expectedBuffer = Buffer.from(expected)

    if (receivedBuffer.length !== expectedBuffer.length) {
        return false
    }

    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
}

export const createEmailRecoveryRoutes = ({
    controller = emailRecoveryController,
} = {}) => {
    const router = express.Router()

    router.post('/', (req, res, next) => {
        res.set('Cache-Control', 'no-store')
        const secret = process.env.EMAIL_RECOVERY_SECRET

        // Sin secreto, la ruta permanece cerrada.
        if (!secret) {
            return res.status(503).json({
                message: 'Recuperación no configurada',
            })
        }

        const authorization = req.get('authorization') || ''
        const expectedAuthorization = `Bearer ${secret}`

        if (!safeCompare(authorization, expectedAuthorization)) {
            return res.status(401).json({
                message: 'No autorizado',
            })
        }

        // El controlador se ejecuta solamente después
        // de verificar correctamente la credencial.
        return Promise.resolve()
            .then(() => controller(req, res))
            .catch(next)
    })

    // Manejo seguro de errores inesperados.
    router.use((error, req, res, next) => {
        console.error(
            'Error interno en recuperación de correos:',
            error.message
        )

        if (res.headersSent) {
            return next(error)
        }

        return res.status(500).json({
            message: 'Error interno de recuperación',
        })
    })

    return router
}

// El servidor utiliza el controlador real.
// Las pruebas podrán inyectar uno simulado.
export default createEmailRecoveryRoutes()
