
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

test('Un fallo al registrar el correo requiere revisión y evita reenvíos', async () => {
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
            name: `LUMINA_DB_FAILURE_${runId}`,
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
                lastName: 'DB_FAILURE',
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
                paymentId: `LUMINA_DB_FAILURE_${runId}`,
            },
        })

        let correosSimulados = 0
        let falloSimulado = false

        originalUpdateOne = OrderModel.updateOne

        // Fallamos una sola vez, únicamente al registrar
        // el correo enviado de nuestro pedido de prueba.
        OrderModel.updateOne = function (filter, update, options) {
            if (
                !falloSimulado &&
                String(filter?._id) === String(order._id) &&
                update?.$set?.confirmationEmailSentAt
            ) {
                falloSimulado = true

                return Promise.reject(
                    new Error('Fallo simulado al registrar el correo')
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

        const primerResultado = await service.recoverOnePendingEmail()

        assert.equal(falloSimulado, true)
        assert.equal(primerResultado.processed, true)
        assert.equal(primerResultado.sent, false)
        assert.equal(primerResultado.needsReview, true)

        const updatedOrder = await OrderModel.findById(order._id)

        assert.equal(updatedOrder.confirmationEmailNeedsReview, true)
        assert.equal(updatedOrder.confirmationEmailSentAt, null)
        assert.equal(updatedOrder.confirmationEmailAttempts, 1)
        assert.equal(updatedOrder.status, 'approved')
        assert.equal(correosSimulados, 1)

        const segundoResultado = await service.recoverOnePendingEmail()

        assert.equal(segundoResultado.processed, false)
        assert.equal(correosSimulados, 1)

        const updatedProduct = await ProductModel.findById(product._id)

        assert.equal(updatedProduct.stock, 9)

        console.log('Fallo de registro simulado:', falloSimulado)
        console.log('Stock final:', updatedProduct.stock)
        console.log('Pedido:', updatedOrder.status)
        console.log('Requiere revisión:', updatedOrder.confirmationEmailNeedsReview)
        console.log('Correos simulados:', correosSimulados)
    } finally {
        // Restauramos la operación original antes de limpiar.
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
