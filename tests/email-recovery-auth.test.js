import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

import { createEmailRecoveryRoutes } from '../src/routes/emailRecoveryRoutes.js'

const withTestServer = async (router, callback) => {
    const app = express()

    app.use(express.json())
    app.use('/api/internal/email-recovery', router)

    const server = app.listen(0)

    try {
        await new Promise((resolve) => {
            server.once('listening', resolve)
        })

        const address = server.address()

        const url = `http://127.0.0.1:${address.port}/api/internal/email-recovery`

        return await callback(url)
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error)
                else resolve()
            })
        })
    }
}

const withTestSecret = async (secret, callback) => {
    const originalSecret = process.env.EMAIL_RECOVERY_SECRET

    try {
        if (secret === null) {
            delete process.env.EMAIL_RECOVERY_SECRET
        } else {
            process.env.EMAIL_RECOVERY_SECRET = secret
        }

        return await callback()
    } finally {
        if (originalSecret === undefined) {
            delete process.env.EMAIL_RECOVERY_SECRET
        } else {
            process.env.EMAIL_RECOVERY_SECRET = originalSecret
        }
    }
}

test('La recuperación permanece cerrada sin secreto configurado', async () => {
    let controllerCalls = 0

    const router = createEmailRecoveryRoutes({
        controller: (_req, res) => {
            controllerCalls++
            return res.status(200).json({ ok: true })
        },
    })

    await withTestSecret(null, async () => {
        await withTestServer(router, async (url) => {
            const response = await fetch(url, {
                method: 'POST',
            })

            const body = await response.json()

            assert.equal(response.status, 503)
            
                assert.equal(
                    response.headers.get('cache-control'),
                    'no-store'
                )

                console.log(
                    'Protección de caché:',
                    response.headers.get('cache-control')
                )

            assert.equal(body.message, 'Recuperación no configurada')
            assert.equal(controllerCalls, 0)

            console.log('Estado HTTP:', response.status)
            console.log('Controlador ejecutado:', false)
        })
    })
})

test('La recuperación rechaza una credencial incorrecta', async () => {
    let controllerCalls = 0

    const router = createEmailRecoveryRoutes({
        controller: (_req, res) => {
            controllerCalls++
            return res.status(200).json({ ok: true })
        },
    })

    await withTestSecret('secreto-ficticio-correcto', async () => {
        await withTestServer(router, async (url) => {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer secreto-ficticio-incorrecto',
                },
            })

            const body = await response.json()

            assert.equal(response.status, 401)
            assert.equal(
    response.headers.get('cache-control'),
    'no-store'
)
            assert.equal(body.message, 'No autorizado')
            assert.equal(controllerCalls, 0)

            console.log('Estado HTTP:', response.status)
            console.log('Controlador ejecutado:', false)
        })
    })
})

test('Una credencial válida ejecuta solamente el controlador simulado', async () => {
    let controllerCalls = 0

    const router = createEmailRecoveryRoutes({
        controller: (_req, res) => {
            controllerCalls++

            return res.status(200).json({
                message: 'Revisión simulada correctamente',
                result: {
                    marked: false,
                    reason: 'no_stale_claims',
                },
            })
        },
    })

    const testSecret = 'secreto-ficticio-autorizado'

    await withTestSecret(testSecret, async () => {
        await withTestServer(router, async (url) => {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${testSecret}`,
                },
            })

            const body = await response.json()

            assert.equal(response.status, 200)
            assert.equal(
    response.headers.get('cache-control'),
    'no-store'
)
            assert.equal(body.message, 'Revisión simulada correctamente')
            assert.equal(controllerCalls, 1)

            assert.deepEqual(body.result, {
                marked: false,
                reason: 'no_stale_claims',
            })

            console.log('Estado HTTP:', response.status)
            console.log('Controlador simulado ejecutado:', controllerCalls)
            console.log('MongoDB utilizado por la prueba:', false)
            console.log('Correos enviados:', 0)
        })
    })
})

test('Un error del controlador autenticado se maneja sin ejecutar recuperación real', async () => {
    let controllerCalls = 0

    const router = createEmailRecoveryRoutes({
        controller: async () => {
            controllerCalls++

            throw new Error('Fallo simulado del controlador')
        },
    })

    const testSecret = 'secreto-ficticio-error'

    await withTestSecret(testSecret, async () => {
        await withTestServer(router, async (url) => {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${testSecret}`,
                },
            })

            assert.equal(response.status, 500)
            assert.equal(
    response.headers.get('cache-control'),
    'no-store'
)

            const body = await response.json()

            assert.deepEqual(body, {
                message: 'Error interno de recuperación',
            })

            assert.equal(
                JSON.stringify(body).includes('Fallo simulado del controlador'),
                false
            )

            console.log('Error interno oculto al cliente:', true)

            assert.equal(controllerCalls, 1)

            console.log('Estado HTTP:', response.status)
            console.log('Controlador simulado ejecutado:', controllerCalls)
            console.log('Recuperación real ejecutada:', false)
        })
    })
})
