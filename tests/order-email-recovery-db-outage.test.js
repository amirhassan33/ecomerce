
import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import mongoose from 'mongoose'

import OrderModel from '../src/models/OrderModel.js'
import ProductModel from '../src/models/ProductModel.js'

import {
    createOrderEmailRecoveryService,
} from '../src/services/orderEmailRecoveryService.js'

test('Una caída de MongoDB conserva la reserva y evita reenvíos', async () => {
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

    let product = null
    let order = null
    let originalUpdateOne = null

    try {
        await mongoose.connect(uri)

        assert.equal(
            mongoose.connection.db.databaseName,
            'ecomerceDB_test'
        )

        product = await ProductModel.create({
            name: `LUMINA_DB_OUTAGE_${runId}`,
            description: 'Producto temporal de prueba',
            price: 3000,
            stock: 9,
            imageUrl: 'https://example.com/test.jpg',
        })

        order = await OrderModel.create({
            products: [{
                productId: product._id,
                name: product.name,
                price: 3000,
                quantity: 1,
                imageUrl: product.imageUrl,
            }],
            totalAmount: 3000,
            status: 'approved',
            shippingInfo: {
                firstName: 'LUMINA_TEST',
                lastName: 'DB_OUTAGE',
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
                paymentId: `LUMINA_DB_OUTAGE_${runId}`,
            },
        })

        let correosSimulados = 0
        let escriturasBloqueadas = 0

        originalUpdateOne = OrderModel.updateOne

        // Simulamos que MongoDB rechaza las escrituras
        // de registro y revisión para este pedido.
        OrderModel.updateOne = function (filter, update, options) {
            if (
                String(filter?._id) === String(order._id) &&
                (
                    update?.$set?.confirmationEmailSentAt ||
                    update?.$set?.confirmationEmailNeedsReview === true
                )
            ) {
                escriturasBloqueadas++

                return Promise.reject(
                    new Error('MongoDB no disponible (simulado)')
                )
            }

            return originalUpdateOne.call(this, filter, update, options)
        }

        const service = createOrderEmailRecoveryService({
            orderId: order._id,
            sendEmail: async () => {
                correosSimulados++
            },
        })

        await assert.rejects(
            service.recoverOnePendingEmail(),
            /MongoDB no disponible \(simulado\)/
        )

        const updatedOrder = await OrderModel.findById(order._id)

        assert.equal(correosSimulados, 1)
        assert.equal(escriturasBloqueadas, 2)
        assert.equal(updatedOrder.status, 'approved')
        assert.equal(updatedOrder.confirmationEmailSentAt, null)
        assert.equal(updatedOrder.confirmationEmailNeedsReview, false)
        assert.equal(updatedOrder.confirmationEmailAttempts, 1)

        assert.ok(
            updatedOrder.confirmationEmailClaimedAt instanceof Date,
            'La reserva debe conservarse'
        )

        // Un nuevo intento no debe reenviar el correo.
        const segundoResultado = await service.recoverOnePendingEmail()

        assert.equal(segundoResultado.processed, false)
        assert.equal(correosSimulados, 1)

        
        // Simulamos que MongoDB volvió a permitir escrituras.
        OrderModel.updateOne = originalUpdateOne

        // Envejecemos la reserva para simular que pasaron
        // 11 minutos, sin esperar realmente ese tiempo.
        const elevenMinutesAgo = new Date(
            Date.now() - 11 * 60 * 1000
        )

        await OrderModel.updateOne(
            { _id: order._id },
            {
                $set: {
                    confirmationEmailClaimedAt: elevenMinutesAgo,
                },
            }
        )

        // Detectamos la reserva abandonada.
        const revisionResultado =
            await service.markStaleClaimForReview()

        assert.equal(revisionResultado.marked, true)

        const reviewedOrder = await OrderModel.findById(order._id)

        assert.equal(
            reviewedOrder.confirmationEmailNeedsReview,
            true
        )

        assert.equal(
            reviewedOrder.confirmationEmailClaimedAt,
            null
        )

        assert.equal(
            reviewedOrder.confirmationEmailSentAt,
            null
        )

        // Aunque se intente recuperar nuevamente,
        // no debe enviarse otro correo.
        const tercerResultado =
            await service.recoverOnePendingEmail()

        assert.equal(tercerResultado.processed, false)
        assert.equal(correosSimulados, 1)

        console.log(
            'Reserva antigua marcada para revisión:',
            revisionResultado.marked
        )
        console.log(
            'Revisión manual requerida:',
            reviewedOrder.confirmationEmailNeedsReview
        )
        console.log(
            'Correos después de recuperar MongoDB:',
            correosSimulados
        )


        const updatedProduct = await ProductModel.findById(product._id)

        assert.equal(updatedProduct.stock, 9)

        console.log('Escrituras bloqueadas:', escriturasBloqueadas)
        console.log('Reserva conservada:', Boolean(updatedOrder.confirmationEmailClaimedAt))
        console.log('Intentos registrados:', updatedOrder.confirmationEmailAttempts)
        console.log('Correos simulados:', correosSimulados)
        console.log('Stock final:', updatedProduct.stock)
    } finally {
        // Restauramos el método original antes de limpiar.
        if (originalUpdateOne) {
            OrderModel.updateOne = originalUpdateOne
        }

        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === 'ecomerceDB_test'
        ) {
            if (order?._id) {
                await OrderModel.deleteOne({ _id: order._id })
            }

            if (product?._id) {
                await ProductModel.deleteOne({ _id: product._id })
            }
        }

        await mongoose.disconnect()
    }
})
