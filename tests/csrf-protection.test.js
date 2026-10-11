import test from 'node:test'
import assert from 'node:assert/strict'
import { csrfProtection } from '../src/middleware/csrfProtection.js'

const originalFrontendUrl = process.env.FRONTEND_URL
process.env.FRONTEND_URL = 'https://tienda.ejemplo.com'

test.after(() => {
    if (originalFrontendUrl === undefined) {
        delete process.env.FRONTEND_URL
    } else {
        process.env.FRONTEND_URL = originalFrontendUrl
    }
})

const executeMiddleware = (method, path, origin) => {
    let statusCode = 200
    let nextCalled = false

    const req = {
        method,
        path,
        get: (header) => (header === 'Origin' ? origin : undefined),
    }

    const res = {
        status(code) {
            statusCode = code
            return this
        },
        json() {
            return this
        },
    }

    csrfProtection(req, res, () => {
        nextCalled = true
    })

    return { statusCode, nextCalled }
}

test('permite solicitudes del frontend autorizado', () => {
    const result = executeMiddleware(
        'POST',
        '/api/orders/create',
        'https://tienda.ejemplo.com'
    )

    assert.equal(result.nextCalled, true)
})

test('rechaza solicitudes de otro origen', () => {
    const result = executeMiddleware(
        'POST',
        '/api/orders/create',
        'https://sitio-malicioso.com'
    )

    assert.equal(result.statusCode, 403)
    assert.equal(result.nextCalled, false)
})

test('rechaza solicitudes sin Origin', () => {
    const result = executeMiddleware('POST', '/api/orders/create')

    assert.equal(result.statusCode, 403)
    assert.equal(result.nextCalled, false)
})

test('permite consultas GET', () => {
    const result = executeMiddleware('GET', '/api/products')

    assert.equal(result.nextCalled, true)
})

test('permite el webhook de Mercado Pago', () => {
    const result = executeMiddleware('POST', '/api/webhook')

    assert.equal(result.nextCalled, true)
})

test('permite la recuperación interna de correos', () => {
    const result = executeMiddleware('POST', '/api/internal/email-recovery')

    assert.equal(result.nextCalled, true)
})
