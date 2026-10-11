import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import mongoose from 'mongoose'

import { createWebHookController } from '../src/controllers/webHookControllers.js'
import OrderModel from '../src/models/OrderModel.js'
import ProductModel from '../src/models/ProductModel.js'

test('Dos webhooks simultáneos no descuentan stock dos veces', async () => {
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
    const paymentId = `LUMINA_CONCURRENTE_${runId}`

    let product = null
    let order = null

    try {
        await mongoose.connect(uri)

        assert.equal(
            mongoose.connection.db.databaseName,
            'ecomerceDB_test'
        )

        product = await ProductModel.create({
            name: `LUMINA_CONCURRENTE_TEST_${runId}`,
            description: 'Producto temporal para prueba simultánea',
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
                lastName: 'CONCURRENCIA',
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

            return statusCode
        }

        // Enviamos las dos notificaciones sin esperar entre ellas.
        const resultados = await Promise.allSettled([
            enviarNotificacion(),
            enviarNotificacion(),
        ])

        const updatedProduct = await ProductModel.findById(product._id)
        const updatedOrder = await OrderModel.findById(order._id)

        console.log(
            'Resultados HTTP:',
            resultados.map(resultado =>
                resultado.status === 'fulfilled'
                    ? resultado.value
                    : 'ERROR'
            )
        )

        console.log('Stock inicial: 10')
        console.log('Stock final:', updatedProduct?.stock)
        console.log('Estado del pedido:', updatedOrder?.status)
        console.log('Consultas simuladas:', consultasSimuladas)
        console.log('Correos simulados:', correosSimulados)

        assert.equal(
            updatedProduct?.stock,
            9,
            'El stock debe descontarse una sola vez'
        )

        assert.equal(
            updatedOrder?.status,
            'approved',
            'El pedido debe quedar aprobado'
        )

        assert.equal(
            updatedOrder?.mercadoPagoData?.paymentId,
            paymentId
        )

        assert.equal(consultasSimuladas, 2)

        assert.equal(
            correosSimulados,
            1,
            'Debe generarse un único correo simulado'
        )

        assert.ok(
            resultados.every(resultado =>
                resultado.status === 'fulfilled'
            ),
            'Ambas llamadas deben finalizar sin excepciones'
        )

        // No exigimos que ambas respondan 200:
        // una transacción concurrente podría responder 500
        // por un conflicto temporal de escritura.
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