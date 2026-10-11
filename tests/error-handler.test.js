import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

import { errorHandler } from '../src/middleware/errorHandler.js'

test('Un error interno devuelve HTTP 500 sin revelar detalles sensibles', async () => {
    const app = express()

    // Ruta de prueba que simula un error inesperado.
    app.get('/error-simulado', async () => {
        throw new Error('Detalle interno secreto de prueba')
    })

    // Utilizamos el mismo manejador que el servidor real.
    app.use(errorHandler)

    const server = app.listen(0)

    try {
        await new Promise((resolve) => {
            server.once('listening', resolve)
        })

        const address = server.address()
        const url = `http://127.0.0.1:${address.port}/error-simulado`

        const response = await fetch(url)
        const body = await response.json()

        assert.equal(response.status, 500)
        assert.deepEqual(body, {
            message: 'Ocurrió un error interno del servidor',
        })

        assert.equal(
            JSON.stringify(body).includes('Detalle interno secreto'),
            false
        )
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error)
                else resolve()
            })
        })
    }
})
