import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import mongoose from 'mongoose'

import { createWebHookController } from '../src/controllers/webHookControllers.js'
import OrderModel from '../src/models/OrderModel.js'
import ProductModel from '../src/models/ProductModel.js'

test('Un pago con importe incorrecto no aprueba el pedido ni descuenta stock', async () => {
    assert.equal(
        process.env.MONGO_DB_NAME?.trim(),
        'ecomerceDB_test',
        'Esta prueba solo puede ejecutarse en ecomerceDB_test'
    )

    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()
    const collectorId = process.env.MERCADOPAGO_COLLECTOR_ID?.trim()

    assert.ok(secret, 'Falta MERCADOPAGO_WEBHOOK_SECRET')
    assert.ok(collectorId, 'Falta MERCADOPAGO_COLLECTOR_ID')

    const uri = process.env.MONGO_DB_URI
        .replace('<db_username>', process.env.MONGO_DB_USER)
        .replace('<db_password>', process.env.MONGO_DB_PASSWORD)
        .replace('<db_name>', process.env.MONGO_DB_NAME)

    let product = null
    let order = null

    await mongoose.connect(uri)

    try {
        assert.equal(
            mongoose.connection.db.databaseName,
            'ecomerceDB_test'
        )

        const runId = crypto.randomUUID()
        const paymentId = `LUMINA_IMPORTE_${runId}`

        product = await ProductModel.create({
            name: `LUMINA_IMPORTE_TEST_${runId}`,
            description: 'Producto temporal para probar importes',
            price: 3000,
            stock: 10,
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
            status: 'pending',
            shippingInfo: {
                firstName: 'LUMINA_TEST',
                lastName: 'IMPORTE',
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
                paymentStatus: 'pending',
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
                transaction_amount: 1000,
                currency_id: 'ARS',
                payment_method_id: 'visa',
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

        const updatedProduct = await ProductModel.findById(product._id)
        const updatedOrder = await OrderModel.findById(order._id)

        assert.equal(statusCode, 500)
        assert.equal(updatedProduct.stock, 10)
        assert.equal(updatedOrder.status, 'pending')
        assert.equal(correosSimulados, 0)

        console.log('Importe del pedido: $3000')
        console.log('Importe del pago simulado: $1000')
        console.log('Stock final: 10')
        console.log('Pedido: pending')
        console.log('Correos simulados: 0')
    } finally {
        if (mongoose.connection.db?.databaseName === 'ecomerceDB_test') {
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