import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

import { Preference } from 'mercadopago'
import ProductModel from '../src/models/ProductModel.js'
import OrderModel from '../src/models/OrderModel.js'
import { createOrder } from '../src/controllers/orderControllers.js'

test('createOrder rechaza un carrito vacío', async () => {
    const req = {
        body: {
            items: [],
            payer: { email: 'comprador@ejemplo.com' },
            shippingInfo: { address: 'Dirección de prueba' },
        },
    }

    const res = {
        statusCode: 200,
        status(code) {
            this.statusCode = code
            return this
        },
        json(body) {
            this.body = body
            return this
        },
    }

    await createOrder(req, res)

    assert.equal(res.statusCode, 400)
    assert.equal(res.body.success, false)
    assert.equal(res.body.message, 'El carrito está vacío')
})
const fakeProduct = {
    _id: {
        toString: () => 'producto_simulado_001',
    },
    name: 'Vela Lúmina de prueba',
    price: 1500,
    stock: 10,
    imageUrl: 'imagen-simulada.jpg',
}
const createFakeRequest = () => ({
    user: {
        _id: '507f1f77bcf86cd799439011',
    },
    body: {
        items: [
            {
                id: fakeProduct._id.toString(),
                quantity: 1,
            },
        ],
        payer: {
            email: 'comprador@ejemplo.com',
        },
        shippingInfo: {
            address: 'Dirección de prueba',
        },
    },
})
const createFakeResponse = () => ({
    statusCode: 200,
    body: null,

    status(code) {
        this.statusCode = code
        return this
    },

    json(body) {
        this.body = body
        return this
    },
})
const mockProductSearch = () =>
    mock.method(ProductModel, 'find', async () => [fakeProduct])

const mockOrderSave = () =>
    mock.method(OrderModel.prototype, 'save', async function () {
        return this
    })

const mockMercadoPagoPreference = (fakeResult) =>
    mock.method(Preference.prototype, 'create', async () => fakeResult)
const restoreMocks = (...mocks) => {
    for (const mockedMethod of mocks.reverse()) {
        mockedMethod.mock.restore()
    }
}
test('createOrder rechaza una preferencia sin init_point', async () => {
    const productMock = mockProductSearch()
    const orderMock = mockOrderSave()
    const paymentMock = mockMercadoPagoPreference({
        id: 'preferencia_simulada_001',
    })

    try {
        const req = createFakeRequest()
        const res = createFakeResponse()

        await createOrder(req, res)

        assert.equal(res.statusCode, 500)
        assert.equal(res.body.success, false)
        assert.equal(res.body.message, 'No se pudo crear la orden')
    } finally {
        restoreMocks(productMock, orderMock, paymentMock)
    }
})
test('createOrder rechaza una preferencia sin id', async () => {
    const productMock = mockProductSearch()
    const orderMock = mockOrderSave()
    const paymentMock = mockMercadoPagoPreference({
        init_point: 'https://ejemplo.com/pago-simulado',
    })

    try {
        const req = createFakeRequest()
        const res = createFakeResponse()

        await createOrder(req, res)

        assert.equal(res.statusCode, 500)
        assert.equal(res.body.success, false)
        assert.equal(res.body.message, 'No se pudo crear la orden')
    } finally {
        restoreMocks(productMock, orderMock, paymentMock)
    }
})