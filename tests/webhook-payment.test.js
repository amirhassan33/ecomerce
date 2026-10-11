import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import mongoose from 'mongoose'

import { createWebHookController } from '../src/controllers/webHookControllers.js'
import OrderModel from '../src/models/OrderModel.js'
import ProductModel from '../src/models/ProductModel.js'

test('Un pago aprobado repetido descuenta stock una sola vez', async () => {
    // Nunca ejecutar esta prueba en la base principal.
    assert.equal(
        process.env.MONGO_DB_NAME?.trim(),
        'ecomerceDB_test',
        'La prueba solo puede ejecutarse en ecomerceDB_test'
    )

    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()
    const collectorId = process.env.MERCADOPAGO_COLLECTOR_ID?.trim()

    assert.ok(secret, 'Falta MERCADOPAGO_WEBHOOK_SECRET')
    assert.ok(collectorId, 'Falta MERCADOPAGO_COLLECTOR_ID')

    const uri = process.env.MONGO_DB_URI.replace(
        '<db_username>',
        process.env.MONGO_DB_USER
    )
        .replace('<db_password>', process.env.MONGO_DB_PASSWORD)
        .replace('<db_name>', process.env.MONGO_DB_NAME)

    const runId = crypto.randomUUID()
    const paymentId = `LUMINA_TEST_${runId}`

    let product = null
    let order = null

    await mongoose.connect(uri)

    try {
        assert.equal(mongoose.connection.db.databaseName, 'ecomerceDB_test')

        product = await ProductModel.create({
            name: `LUMINA_TEST_${runId}`,
            description: 'Producto temporal para pruebas automáticas',
            price: 3000,
            stock: 10,
            imageUrl: 'https://example.com/vela-test.jpg',
        })

        order = await OrderModel.create({
            products: [
                {
                    productId: product._id,
                    name: product.name,
                    price: 3000,
                    quantity: 1,
                    imageUrl: product.imageUrl,
                },
            ],
            totalAmount: 3000,
            status: 'pending',
            shippingInfo: {
                firstName: 'LUMINA_TEST',
                lastName: 'AUTOMATIZADO',
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

        let consultasSimuladas = 0
        let correosSimulados = 0

        const controller = createWebHookController({
            getPayment: async (requestedPaymentId) => {
                consultasSimuladas++

                assert.equal(requestedPaymentId, paymentId)

                return {
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
                }
            },

            sendEmail: async () => {
                correosSimulados++
            },
        })

        const enviarNotificacion = async () => {
            const ts = String(Date.now())
            const requestId = crypto.randomUUID()

            const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`

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

            assert.equal(statusCode, 200, `El webhook respondió ${statusCode}`)
        }

        // Primer pago aprobado.
        await enviarNotificacion()

        let updatedProduct = await ProductModel.findById(product._id)
        let updatedOrder = await OrderModel.findById(order._id)

        assert.equal(updatedProduct.stock, 9)
        assert.equal(updatedOrder.status, 'approved')
        assert.equal(updatedOrder.mercadoPagoData.paymentId, paymentId)

        // Dos notificaciones repetidas.
        await enviarNotificacion()
        await enviarNotificacion()

        updatedProduct = await ProductModel.findById(product._id)
        updatedOrder = await OrderModel.findById(order._id)

        assert.equal(updatedProduct.stock, 9)
        assert.equal(updatedOrder.status, 'approved')
        assert.equal(consultasSimuladas, 3)
        assert.equal(correosSimulados, 1)

        console.log('Stock inicial: 10')
        console.log('Stock final: 9')
        console.log('Notificaciones procesadas: 3')
        console.log('Correos simulados: 1')
    } finally {
        // Eliminar exclusivamente los documentos creados por esta ejecución.
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
