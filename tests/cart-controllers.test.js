import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

import ProductModel from '../src/models/ProductModel.js'
import CartModel from '../src/models/CartModel.js'
import { addToCart, updateCart } from '../src/controllers/cartControllers.js'

const createResponse = () => ({
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

test('addToCart rechaza cantidades inválidas sin consultar productos', async () => {
    for (const quantity of [0, -1, 1.5, '2', null]) {
        const productMock = mock.method(ProductModel, 'findById', async () => {
            assert.fail('No debería consultar el producto')
        })

        try {
            const req = {
                user: { _id: '507f1f77bcf86cd799439011' },
                body: {
                    productId: '507f1f77bcf86cd799439012',
                    quantity,
                },
            }

            const res = createResponse()

            await addToCart(req, res)

            assert.equal(res.statusCode, 400)
            assert.equal(
                res.body.message,
                'La cantidad debe ser un número entero mayor o igual a 1'
            )
        } finally {
            productMock.mock.restore()
        }
    }
})

test('updateCart rechaza cantidades inválidas sin consultar el carrito', async () => {
    for (const quantity of [0, -1, 1.5, '2', null]) {
        const cartMock = mock.method(CartModel, 'findOne', async () => {
            assert.fail('No debería consultar el carrito')
        })

        try {
            const req = {
                user: { _id: '507f1f77bcf86cd799439011' },
                body: {
                    productId: '507f1f77bcf86cd799439012',
                    quantity,
                },
            }

            const res = createResponse()

            await updateCart(req, res)

            assert.equal(res.statusCode, 400)
            assert.equal(
                res.body.message,
                'La cantidad debe ser un número entero mayor o igual a 1'
            )
        } finally {
            cartMock.mock.restore()
        }
    }
})

test('addToCart rechaza superar el stock acumulado del carrito', async () => {
    const productId = '507f1f77bcf86cd799439012'
    const product = { _id: productId, stock: 5 }

    const cart = {
        products: [{ productId, quantity: 4 }],
        save: async () => {
            assert.fail('No debería guardar un carrito que supera el stock')
        },
        populate: async () => cart,
    }

    const productMock = mock.method(
        ProductModel,
        'findById',
        async () => product
    )
    const cartMock = mock.method(CartModel, 'findOne', async () => cart)

    try {
        const req = {
            user: { _id: '507f1f77bcf86cd799439011' },
            body: { productId, quantity: 2 },
        }
        const res = createResponse()

        await addToCart(req, res)

        assert.equal(res.statusCode, 400)
        assert.equal(res.body.message, 'Solo hay 5 unidades disponibles')
        assert.equal(cart.products[0].quantity, 4)
    } finally {
        cartMock.mock.restore()
        productMock.mock.restore()
    }
})

test('addToCart rechaza superar el stock al crear un carrito nuevo', async () => {
    const productId = '507f1f77bcf86cd799439012'

    const productMock = mock.method(ProductModel, 'findById', async () => ({
        _id: productId,
        stock: 3,
    }))
    const cartMock = mock.method(CartModel, 'findOne', async () => null)
    const saveMock = mock.method(CartModel.prototype, 'save', async () => {
        assert.fail('No debería guardar un carrito que supera el stock')
    })

    try {
        const req = {
            user: { _id: '507f1f77bcf86cd799439011' },
            body: { productId, quantity: 4 },
        }
        const res = createResponse()

        await addToCart(req, res)

        assert.equal(res.statusCode, 400)
        assert.equal(res.body.message, 'Solo hay 3 unidades disponibles')
    } finally {
        saveMock.mock.restore()
        cartMock.mock.restore()
        productMock.mock.restore()
    }
})
