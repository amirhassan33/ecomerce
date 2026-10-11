import test from 'node:test'
import assert from 'node:assert/strict'
import { createWebHookController } from '../src/controllers/webHookControllers.js'
import OrderModel from '../src/models/OrderModel.js'
import ProductModel from '../src/models/ProductModel.js'

test('Un pedido aprobado no vuelve a in_process por una notificación atrasada', async () => {
    const orderId = '507f1f77bcf86cd799439011'
    const paymentId = 'pago_simulado_001'
    const collectorId = 'colector_simulado_001'

    const order = {
        _id: orderId,
        status: 'approved',
        totalAmount: 3000,
        products: [],
        mercadoPagoData: {
            paymentId,
            paymentStatus: 'approved',
        },
        save: async () => {
            assert.fail('No debería modificar un pedido ya aprobado')
        },
    }

    const transaction = async (callback) => callback({})

    const originalTransaction = OrderModel.db.transaction
    const originalFindById = OrderModel.findById
    const originalFindOne = OrderModel.findOne
    const originalUpdateOne = ProductModel.updateOne

    OrderModel.db.transaction = transaction
    OrderModel.findById = () => ({
        session: async () => order,
    })
    OrderModel.findOne = async () => null
    ProductModel.updateOne = async () => {
        assert.fail('No debería descontar stock nuevamente')
    }

    const originalSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET
    const originalCollector = process.env.MERCADOPAGO_COLLECTOR_ID

    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'secreto_simulado'
    process.env.MERCADOPAGO_COLLECTOR_ID = collectorId

    try {
        const controller = createWebHookController({
            getPayment: async () => ({
                id: paymentId,
                collector_id: collectorId,
                external_reference: orderId,
                status: 'in_process',
                transaction_amount: 3000,
                currency_id: 'ARS',
            }),
            sendEmail: async () => {
                assert.fail('No debería enviar un correo')
            },
            createEmailRecoveryService: () => ({
                recoverOnePendingEmail: async () => ({
                    processed: false,
                    reason: 'no_pending_orders',
                }),
            }),
        })

        const ts = String(Date.now())
        const requestId = 'request_simulado_001'
        const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`

        const { createHmac } = await import('node:crypto')
        const signature = createHmac(
            'sha256',
            process.env.MERCADOPAGO_WEBHOOK_SECRET
        )
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

        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code
                return this
            },
            json(body) {
                this.body = body
                return this
            },
        }

        await controller(req, res)

        assert.equal(res.statusCode, 200)
        assert.equal(order.status, 'approved')
        assert.equal(order.mercadoPagoData.paymentStatus, 'approved')
    } finally {
        OrderModel.db.transaction = originalTransaction
        OrderModel.findById = originalFindById
        OrderModel.findOne = originalFindOne
        ProductModel.updateOne = originalUpdateOne

        if (originalSecret === undefined) {
            delete process.env.MERCADOPAGO_WEBHOOK_SECRET
        } else {
            process.env.MERCADOPAGO_WEBHOOK_SECRET = originalSecret
        }

        if (originalCollector === undefined) {
            delete process.env.MERCADOPAGO_COLLECTOR_ID
        } else {
            process.env.MERCADOPAGO_COLLECTOR_ID = originalCollector
        }
    }
})
