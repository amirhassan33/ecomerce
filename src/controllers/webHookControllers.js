import OrderModel from '../models/OrderModel.js'
import ProductModel from '../models/ProductModel.js'
import { client } from '../config/mercadoPagoConfig.js'
import { Payment } from 'mercadopago'
import crypto from 'crypto'
import { sendOrderConfirmationEmail } from '../services/emailService.js'

const validateSignature = (req, res) => {
    try {
        // Obtenemos la firma y el secreto
        const signature = req.headers['x-signature']
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET

        // Validamos que existan
        if (!signature || !secret) {
            return false
        }

        // Split por coma
        const parts = signature.split(',').map((part) => part.trim())

        const ts = parts.find((part) => part.startsWith('ts='))?.split('=')[1]
        const hash = parts.find((part) => part.startsWith('v1='))?.split('=')[1]

        // Obtener x-request-id del header
        const xRequestId = req.headers['x-request-id']

        // Obtener data.id según el formato del webhook
        // Usar el ID de la URL para verificar la firma
        const dataId = req.query['data.id']

        if (
            typeof dataId !== 'string' ||
            !dataId ||
            !xRequestId ||
            !ts ||
            !hash
        ) {
            return false
        }

        // Crear manifest según la documentación oficial
        const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`

        // Generar el hash esperado
        const expectedHash = crypto
            .createHmac('sha256', secret) // Usar el secreto configurado
            .update(manifest) // Añadir el manifest
            .digest('hex') // Generar hash en hexadecimal

        // Compararlo de manera segura
        const isValid = crypto.timingSafeEqual(
            Buffer.from(hash, 'hex'), // Hash recibido de MP
            Buffer.from(expectedHash, 'hex') // Hash que esperamos
        )

        return isValid
    } catch (error) {
        return false
    }
}

const webHookController = async (req, res) => {
    try {
        const type = req.body?.type || req.query.type

        // Este controlador procesa Webhooks de payment
        if (type !== 'payment') {
            return res.status(200).json({
                message: 'Notificación ignorada',
            })
        }

        if (!validateSignature(req)) {
            return res.status(401).json({
                message: 'Firma inválida',
            })
        }

        // Consultamos el mismo ID utilizado para validar la firma
        const paymentId = req.query['data.id']
        const payment = await new Payment(client).get({
            id: paymentId,
        })

        const orderId = payment.external_reference

        if (typeof orderId !== 'string' || !/^[a-fA-F0-9]{24}$/.test(orderId)) {
            return res.status(400).json({
                message: 'El pago no tiene una referencia de orden válida',
            })
        }

        // Estados que admite tu modelo actual
        const supportedStatuses = [
            'pending',
            'approved',
            'rejected',
            'cancelled',
            'in_process',
        ]

        if (!supportedStatuses.includes(payment.status)) {
            console.warn('Estado no implementado:', payment.status)

            return res.status(200).json({
                message: 'Estado no implementado; requiere revisión',
            })
        }

        // Guardar orden y stock juntos:
        // si algo falla, se revierten los cambios de esta transacción
        await OrderModel.db.transaction(async (session) => {
            const order = await OrderModel.findById(orderId).session(session)

            if (!order) {
                throw new Error('Orden no encontrada')
            }

            // Una orden ya procesada no vuelve a descontar stock
            if (order.status === 'approved') {
                return
            }

            if (payment.status === 'approved') {
                const paidAmount = Number(payment.transaction_amount)

                if (
                    !Number.isFinite(paidAmount) ||
                    Math.round(paidAmount * 100) !==
                        Math.round(order.totalAmount * 100) ||
                    payment.currency_id !== 'ARS'
                ) {
                    throw new Error(
                        'El importe o la moneda no coincide con la orden'
                    )
                }

                for (const item of order.products) {
                    if (
                        !Number.isInteger(item.quantity) ||
                        item.quantity <= 0
                    ) {
                        throw new Error('Cantidad de producto inválida')
                    }

                    const result = await ProductModel.updateOne(
                        {
                            _id: item.productId,
                            stock: { $gte: item.quantity },
                        },
                        {
                            $inc: { stock: -item.quantity },
                        },
                        { session }
                    )

                    if (result.modifiedCount !== 1) {
                        throw new Error(
                            `Producto inexistente o stock insuficiente: ${item.productId}`
                        )
                    }
                }
            }

            // No convertir un pago pendiente en rechazado
            order.status = payment.status

            order.mercadoPagoData.paymentId = String(payment.id)
            order.mercadoPagoData.paymentStatus = payment.status
            order.mercadoPagoData.transactionAmount = payment.transaction_amount
            order.mercadoPagoData.paymentMethodId = payment.payment_method_id

            if (payment.status === 'approved') {
                order.mercadoPagoData.paidAt = payment.date_approved
            }

            await order.save({ session })
        })

        const approvedOrder = await OrderModel.findOne({
            _id: orderId,
            status: 'approved',
            confirmationEmailSentAt: null,
        })

        if (approvedOrder) {
            await sendOrderConfirmationEmail(approvedOrder)

            approvedOrder.confirmationEmailSentAt = new Date()
            await approvedOrder.save()

            console.log(
                `Correo de confirmación enviado para la orden ${approvedOrder._id}`
            )
        }

        return res.status(200).json({
            message: 'Notificación procesada correctamente',
        })
    } catch (error) {
        console.error('Error al procesar webhook:', error.message)

        return res.status(500).json({
            message: 'No se pudo procesar la notificación',
        })
    }
}

export default webHookController
