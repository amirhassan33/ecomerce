
import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import mongoose from 'mongoose'

import OrderModel from '../src/models/OrderModel.js'
import {
    createOrderEmailRecoveryService,
} from '../src/services/orderEmailRecoveryService.js'

test('Una reserva abandonada requiere revisión sin reenviar correo', async () => {
    assert.equal(
        process.env.MONGO_DB_NAME?.trim(),
        'ecomerceDB_test',
        'Esta prueba solo puede ejecutarse en ecomerceDB_test'
    )

    assert.ok(process.env.MONGO_DB_URI, 'Falta MONGO_DB_URI')
    assert.ok(process.env.MONGO_DB_USER, 'Falta MONGO_DB_USER')
    assert.ok(process.env.MONGO_DB_PASSWORD, 'Falta MONGO_DB_PASSWORD')

    const uri = process.env.MONGO_DB_URI
        .replace('<db_username>', process.env.MONGO_DB_USER)
        .replace('<db_password>', process.env.MONGO_DB_PASSWORD)
        .replace('<db_name>', process.env.MONGO_DB_NAME)

    const runId = crypto.randomUUID()
    let order = null

    try {
        await mongoose.connect(uri)

        assert.equal(
            mongoose.connection.db.databaseName,
            'ecomerceDB_test'
        )

        const oldClaim = new Date(
            Date.now() - 15 * 60 * 1000
        )

        order = await OrderModel.create({
            products: [{
                productId: new mongoose.Types.ObjectId(),
                name: `LUMINA_STALE_TEST_${runId}`,
                price: 3000,
                quantity: 1,
            }],
            totalAmount: 3000,
            status: 'approved',
            confirmationEmailClaimedAt: oldClaim,
            confirmationEmailAttempts: 1,
            shippingInfo: {
                firstName: 'LUMINA_TEST',
                lastName: 'RESERVA',
                email: 'prueba@example.invalid',
                phone: '0000000000',
                address: {
                    street: 'Calle de prueba',
                    number: '123',
                    city: 'Ciudad de prueba',
                    state: 'Provincia de prueba',
                    zipCode: '0000',
                },
            },
            mercadoPagoData: {
                paymentStatus: 'approved',
                paymentId: `LUMINA_STALE_${runId}`,
            },
        })

        let correosSimulados = 0

        const service = createOrderEmailRecoveryService({
            orderId: order._id,
            sendEmail: async () => {
                correosSimulados++
            },
        })

        // Esta función será incorporada al servicio
        // en el siguiente paso.
        const resultado = await service.markStaleClaimForReview()

        const updatedOrder = await OrderModel.findById(order._id)

        assert.equal(resultado.marked, true)
        assert.equal(updatedOrder.confirmationEmailNeedsReview, true)
        assert.equal(updatedOrder.confirmationEmailSentAt, null)
        assert.equal(updatedOrder.status, 'approved')
        assert.equal(correosSimulados, 0)

        // La recuperación normal tampoco debe reenviar.
        const retry = await service.recoverOnePendingEmail()

        assert.equal(retry.processed, false)
        assert.equal(correosSimulados, 0)

        console.log('Reserva antigua detectada:', resultado.marked)
        console.log('Requiere revisión:', updatedOrder.confirmationEmailNeedsReview)
        console.log('Correos simulados:', correosSimulados)
    } finally {
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === 'ecomerceDB_test'
        ) {
            if (order?._id) {
                await OrderModel.deleteOne({ _id: order._id })
            }
        }

        await mongoose.disconnect()
    }
})
