import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import UserModel from '../src/models/UserModel.js'
import { resetPassword } from '../src/controllers/authControllers.js'

const createFakeResponse = () => ({
    statusCode: 200,
    body: null,
    clearedCookies: [],

    status(code) {
        this.statusCode = code
        return this
    },

    json(body) {
        this.body = body
        return this
    },

    clearCookie(name) {
        this.clearedCookies.push(name)
        return this
    },
})
const createFakeRequest = (token, password = 'NuevaClaveSegura123!') => ({
    params: {
        token,
    },
    body: {
        password,
    },
})
const fakeToken = 'token-de-prueba-lumina-123456789'

const fakeTokenHash = crypto
    .createHash('sha256')
    .update(fakeToken)
    .digest('hex')
const mockAtomicPasswordReset = () => {
    let tokenAvailable = true

    return mock.method(
        UserModel,
        'findOneAndUpdate',
        async (filter, update) => {
            assert.equal(filter.resetPasswordTokenHash, fakeTokenHash)
            assert.ok(filter.resetPasswordExpiresAt.$gt instanceof Date)

            assert.equal(typeof update.$set.password, 'string')
            assert.ok(update.$set.password.startsWith('$2'))

            assert.ok(Object.hasOwn(update.$unset, 'resetPasswordTokenHash'))
            assert.ok(Object.hasOwn(update.$unset, 'resetPasswordExpiresAt'))

            if (!tokenAvailable) {
                return null
            }

            tokenAvailable = false

            return {
                _id: 'usuario_simulado_001',
            }
        }
    )
}
test('resetPassword impide reutilizar un token', async () => {
    const databaseMock = mockAtomicPasswordReset()

    try {
        const firstResponse = createFakeResponse()

        await resetPassword(createFakeRequest(fakeToken), firstResponse)

        assert.equal(firstResponse.statusCode, 200)
        assert.ok(firstResponse.clearedCookies.includes('accessToken'))

        const secondResponse = createFakeResponse()

        await resetPassword(createFakeRequest(fakeToken), secondResponse)

        assert.equal(secondResponse.statusCode, 400)
        assert.match(secondResponse.body.message, /inválido o venció/)

        assert.equal(databaseMock.mock.callCount(), 2)
    } finally {
        databaseMock.mock.restore()
    }
})
test('resetPassword acepta solo una solicitud simultánea por token', async () => {
    const databaseMock = mockAtomicPasswordReset()

    try {
        const firstResponse = createFakeResponse()
        const secondResponse = createFakeResponse()

        await Promise.all([
            resetPassword(createFakeRequest(fakeToken), firstResponse),
            resetPassword(createFakeRequest(fakeToken), secondResponse),
        ])

        const statusCodes = [
            firstResponse.statusCode,
            secondResponse.statusCode,
        ].sort()

        assert.deepEqual(statusCodes, [200, 400])
        assert.equal(databaseMock.mock.callCount(), 2)
    } finally {
        databaseMock.mock.restore()
    }
})
