import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import mongoose from 'mongoose'

import OrderModel from '../src/models/OrderModel.js'
import ProductModel from '../src/models/ProductModel.js'
import { createOrderEmailRecoveryService } from '../src/services/orderEmailRecoveryService.js'

test('Recuperar un correo pendiente sin duplicarlo ni modificar stock', async () => {
    assert.equal(
        process.env.MONGO_DB_NAME?.trim(),
        'ecomerceDB_test',
        'Esta prueba solo puede ejecutarse en ecomerceDB_test'
    )

    assert.ok(process.env.MONGO_DB_URI, 'Falta MONGO_DB_URI')
    assert.ok(process.env.MONGO_DB_USER, 'Falta MONGO_DB_USER')
    assert.ok(process.env.MONGO_DB_PASSWORD, 'Falta MONGO_DB_PASSWORD')

    const uri = process.env.MONGO_DB_URI.replace(
        '<db_username>',
        process.env.MONGO_DB_USER
    )
        .replace('<db_password>', process.env.MONGO_DB_PASSWORD)
        .replace('<db_name>', process.env.MONGO_DB_NAME)

    const runId = crypto.randomUUID()

    let product = null
    let order = null

    try {
        await mongoose.connect(uri)

        assert.equal(mongoose.connection.db.databaseName, 'ecomerceDB_test')

        product = await ProductModel.create({
            name: `LUMINA_RECOVERY_TEST_${runId}`,
            description: 'Producto temporal de prueba',
            price: 3000,
            stock: 9,
            imageUrl: 'https://example.com/vela.jpg',
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
            status: 'approved',
            shippingInfo: {
                firstName: 'LUMINA_TEST',
                lastName: 'RECOVERY',
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
                paymentId: `LUMINA_RECOVERY_${runId}`,
            },
        })

        let correosSimulados = 0

        const service = createOrderEmailRecoveryService({
            orderId: order._id,
            sendEmail: async () => {
                correosSimulados++
            },
        })

        const resultado = await service.recoverOnePendingEmail()

        assert.equal(resultado.processed, true)
        assert.equal(resultado.sent, true)
        assert.equal(resultado.orderId, String(order._id))

        const updatedOrder = await OrderModel.findById(order._id)
        const updatedProduct = await ProductModel.findById(product._id)

        assert.ok(updatedOrder.confirmationEmailSentAt)
        assert.equal(updatedOrder.status, 'approved')
        assert.equal(updatedProduct.stock, 9)
        assert.equal(correosSimulados, 1)

        // No debe volver a enviar el mismo correo.
        await service.recoverOnePendingEmail()

        const finalOrder = await OrderModel.findById(order._id)

        assert.ok(finalOrder.confirmationEmailSentAt)
        assert.equal(correosSimulados, 1)

        console.log('Stock final:', updatedProduct.stock)
        console.log('Estado del pedido:', updatedOrder.status)
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
