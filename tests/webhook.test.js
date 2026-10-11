import test from 'node:test'
import assert from 'node:assert/strict'

import webHookController from '../src/controllers/webHookControllers.js'

test('El webhook rechaza una firma inválida', async () => {
    const req = {
        body: {
            type: 'payment',
            data: {
                id: '123456',
            },
        },
        query: {
            'data.id': '123456',
        },
        headers: {
            'x-signature': 'ts=123456,v1=firma_invalida',
            'x-request-id': 'test-request-001',
        },
    }

    let statusCode = null
    let responseBody = null

    const res = {
        status(code) {
            statusCode = code
            return this
        },
        json(body) {
            responseBody = body
            return this
        },
    }

    await webHookController(req, res)

    assert.equal(statusCode, 401)
    assert.deepEqual(responseBody, {
        message: 'Firma inválida',
    })
})

test('El webhook rechaza una notificación sin firma', async () => {
    const req = {
        body: {
            type: 'payment',
            data: { id: '123456' },
        },
        query: {
            'data.id': '123456',
        },
        headers: {
            'x-request-id': 'test-request-002',
        },
    }

    let statusCode = null
    let responseBody = null

    const res = {
        status(code) {
            statusCode = code
            return this
        },
        json(body) {
            responseBody = body
            return this
        },
    }

    await webHookController(req, res)

    assert.equal(statusCode, 401)
    assert.deepEqual(responseBody, {
        message: 'Firma inválida',
    })
})