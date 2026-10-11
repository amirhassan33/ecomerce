
import test from 'node:test'
import assert from 'node:assert/strict'

import {
    createEmailRecoveryController,
} from '../src/controllers/emailRecoveryController.js'

test(
    'El controlador revisa reservas sin enviar correos',
    async () => {
        let reviewCalls = 0

        const fakeRecoveryService = {
            async markStaleClaimForReview() {
                reviewCalls++

                return {
                    marked: false,
                    reason: 'no_stale_claims',
                }
            },
        }

        const controller = createEmailRecoveryController({
            recoveryService: fakeRecoveryService,
        })

        let statusCode = null
        let responseBody = null

        const fakeResponse = {
            status(code) {
                statusCode = code
                return this
            },
            json(body) {
                responseBody = body
                return this
            },
        }

        await controller({}, fakeResponse)

        assert.equal(statusCode, 200)
        assert.equal(reviewCalls, 1)
        assert.deepEqual(responseBody, {
            message: 'Revisión de reservas completada',
            result: {
                marked: false,
                reason: 'no_stale_claims',
            },
        })

        console.log('Revisiones simuladas:', reviewCalls)
        console.log('Estado HTTP:', statusCode)
        console.log('Resultado:', responseBody.result)
    }
)


test(
    'El controlador responde de forma segura si falla la revisión',
    async () => {
        const fakeRecoveryService = {
            async markStaleClaimForReview() {
                throw new Error('Fallo simulado de MongoDB')
            },
        }

        const controller = createEmailRecoveryController({
            recoveryService: fakeRecoveryService,
        })

        let statusCode = null
        let responseBody = null

        const fakeResponse = {
            status(code) {
                statusCode = code
                return this
            },
            json(body) {
                responseBody = body
                return this
            },
        }

        await controller({}, fakeResponse)

        assert.equal(statusCode, 500)

        assert.deepEqual(responseBody, {
            message: 'No se pudo revisar las reservas de correo',
        })

        assert.equal(
            JSON.stringify(responseBody).includes('MongoDB'),
            false
        )

        console.log('Estado HTTP:', statusCode)
        console.log('Error interno oculto:', true)
    }
)
