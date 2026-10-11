
import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import mongoose from 'mongoose'

import { createWebHookController } from '../src/controllers/webHookControllers.js'
import OrderModel from '../src/models/OrderModel.js'
import ProductModel from '../src/models/ProductModel.js'

test('Un webhook repetido no reenvía un correo en revisión', async () => {
    assert.equal(
        process.env.MONGO_DB_NAME?.trim(),
        'ecomerceDB_test',
        'Esta prueba solo puede ejecutarse en ecomerceDB_test'
    )

    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()
    const collectorId = process.env.MERCADOPAGO_COLLECTOR_ID?.trim()

    assert.ok(secret, 'Falta MERCADOPAGO_WEBHOOK_SECRET')
    assert.ok(collectorId, 'Falta MERCADOPAGO_COLLECTOR_ID')
    assert.ok(process.env.MONGO_DB_URI, 'Falta MONGO_DB_URI')
    assert.ok(process.env.MONGO_DB_USER, 'Falta MONGO_DB_USER')
    assert.ok(process.env.MONGO_DB_PASSWORD, 'Falta MONGO_DB_PASSWORD')

    const uri = process.env.MONGO_DB_URI
        .replace('<db_username>', process.env.MONGO_DB_USER)
        .replace('<db_password>', process.env.MONGO_DB_PASSWORD)
        .replace('<db_name>', process.env.MONGO_DB_NAME)

    const runId = crypto.randomUUID()
    const paymentId = `LUMINA_REVIEW_${runId}`

    let product = null
    let order = null

    try {
        await mongoose.connect(uri)

        assert.equal(
            mongoose.connection.db.databaseName,
            'ecomerceDB_test'
        )

        product = await ProductModel.create({
            name: `LUMINA_REVIEW_TEST_${runId}`,
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
            confirmationEmailNeedsReview: true,
            confirmationEmailAttempts: 1,
            shippingInfo: {
                firstName: 'LUMINA_TEST',
                lastName: 'REVISION',
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
                paymentId,
            },
        })

        let correosSimulados = 0

        const controller = createWebHookController({
            getPayment: async () => ({
                id: paymentId,
                collector_id: collectorId,
                external_reference: String(order._id),
                metadata: {
                    order_id: String(order._id),
                },
                status: 'approved',
                transaction_amount: 3000,
                currency_id: 'ARS',
                payment_method_id: 'visa',
                date_approved: new Date(),
            }),

            sendEmail: async () => {
                correosSimulados++
            },
        })

        const ts = String(Date.now())
        const requestId = crypto.randomUUID()

        const manifest =
            `id:${paymentId};request-id:${requestId};ts:${ts};`

        const signature = crypto
            .createHmac('sha256', secret)
            .update(manifest)
            .digest('hex')

        const req = {
            body: {
                type: 'payment',
                data: { id: paymentId },
            },
            query: {
                'data.id': paymentId,
            },
            headers: {
                'x-signature': `ts=${ts},v1=${signature}`,
                'x-request-id': requestId,
            },
        }

        let statusCode = null

        const res = {
            status(code) {
                statusCode = code
                return this
            },
            json(body) {
                this.body = body
                return this
            },
        }

        await controller(req, res)

        const updatedOrder = await OrderModel.findById(order._id)
        const updatedProduct = await ProductModel.findById(product._id)

        assert.equal(statusCode, 200)
        assert.equal(correosSimulados, 0)
        assert.equal(updatedProduct.stock, 9)
        assert.equal(updatedOrder.status, 'approved')
        assert.equal(updatedOrder.confirmationEmailNeedsReview, true)
        assert.equal(updatedOrder.confirmationEmailAttempts, 1)
        assert.equal(updatedOrder.confirmationEmailSentAt, null)

        console.log('Respuesta HTTP:', statusCode)
        console.log('Stock final:', updatedProduct.stock)
        console.log('Pedido:', updatedOrder.status)
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

            if (product?._id) {
                await ProductModel.deleteOne({ _id: product._id })
            }
        }

        await mongoose.disconnect()
    }
})
