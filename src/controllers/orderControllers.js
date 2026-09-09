import { Preference } from 'mercadopago'
import { client } from '../config/mercadoPagoConfig.js'
import ProductModel from '../models/ProductModel.js'
import OrderModel from '../models/OrderModel.js'

const preference = new Preference(client)

export const createOrder = async (req, res) => {
    try {
        const { items, payer, shippingInfo } = req.body

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'El carrito está vacío',
            })
        }

        if (!payer?.email) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere el email del comprador',
            })
        }

        if (!shippingInfo) {
            return res.status(400).json({
                success: false,
                message: 'Se requieren los datos de envío',
            })
        }

        // Agrupar productos repetidos y validar cantidades
        const quantitiesByProduct = new Map()

        for (const item of items) {
            const quantity = Number(item.quantity)

            if (!item.id) {
                return res.status(400).json({
                    success: false,
                    message: 'Hay un producto sin identificador',
                })
            }

            if (!Number.isInteger(quantity) || quantity < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'La cantidad de cada producto debe ser un entero mayor a cero',
                })
            }

            const currentQuantity = quantitiesByProduct.get(item.id) || 0
            quantitiesByProduct.set(item.id, currentQuantity + quantity)
        }

        const productIds = [...quantitiesByProduct.keys()]

        // Obtener nombres, precios y stock verdaderos desde MongoDB
        const products = await ProductModel.find({
            _id: { $in: productIds },
        })

        if (products.length !== productIds.length) {
            return res.status(400).json({
                success: false,
                message: 'Uno o más productos no existen',
            })
        }

        const trustedItems = []
        const orderProducts = []

        for (const product of products) {
            const quantity = quantitiesByProduct.get(product._id.toString())

            if (quantity > product.stock) {
                return res.status(400).json({
                    success: false,
                    message: `Solo hay ${product.stock} unidades disponibles de ${product.name}`,
                })
            }

            // Datos seguros que se enviarán a Mercado Pago
            trustedItems.push({
                id: product._id.toString(),
                title: product.name,
                quantity,
                unit_price: product.price,
                currency_id: 'ARS',
            })

            // Datos que se guardarán en nuestra orden
            orderProducts.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                quantity,
                imageUrl: product.imageUrl,
            })
        }

        const totalAmount = orderProducts.reduce(
            (total, product) =>
                total + product.price * product.quantity,
            0
        )

        const newOrder = new OrderModel({
            userId: req.user._id,
            products: orderProducts,
            totalAmount,
            status: 'pending',
            shippingInfo,
            mercadoPagoData: {
                payerEmail: payer.email,
            },
        })

        const savedOrder = await newOrder.save()

        const result = await preference.create({
            body: {
                items: trustedItems,
                payer: {
                    email: payer.email,
                },
                external_reference: savedOrder._id.toString(),
                back_urls: {
                    success: `${process.env.FRONTEND_URL}/payment/success`,
                    failure: `${process.env.FRONTEND_URL}/payment/failure`,
                    pending: `${process.env.FRONTEND_URL}/payment/pending`,
                },
                metadata: {
                    order_id: savedOrder._id.toString(),
                },
            },
        })

        savedOrder.mercadoPagoData.preferenceId = result.id
        await savedOrder.save()

        return res.status(201).json({
            success: true,
            message: 'Orden creada exitosamente',
            paymentUrl: result.init_point,
            preferenceId: result.id,
        })
    } catch (error) {
        console.error('Error al crear la orden:', error.message)

        return res.status(500).json({
            success: false,
            message: 'No se pudo crear la orden',
        })
    }
}

export const getMyOrders = async (req, res) => {
    try {
        const orders = await OrderModel.find({
            userId: req.user._id,
        }).sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            orders,
        })
    } catch (error) {
        console.error('Error al obtener las órdenes:', error.message)

        return res.status(500).json({
            success: false,
            message: 'No se pudieron obtener tus órdenes',
        })
    }
}

export const getAllOrders = async (req, res) => {
    try {
        const orders = await OrderModel.find()
            .populate('userId', 'username email')
            .sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            orders,
        })
    } catch (error) {
        console.error('Error al obtener las órdenes:', error.message)

        return res.status(500).json({
            success: false,
            message: 'No se pudieron obtener las órdenes',
        })
    }
}

export const getOrderById = async (req, res) => {
    try {
        const order = await OrderModel.findById(req.params.id)

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Orden no encontrada',
            })
        }

        const isOwner =
            order.userId?.toString() === req.user._id.toString()

        if (!isOwner && !req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para consultar esta orden',
            })
        }

        return res.status(200).json({
            success: true,
            order,
        })
    } catch (error) {
        console.error('Error al obtener la orden:', error.message)

        return res.status(500).json({
            success: false,
            message: 'No se pudo obtener la orden',
        })
    }
}