import OrderModel from '../models/OrderModel.js'
import ProductModel from '../models/ProductModel.js'
import { client } from '../config/mercadoPagoConfig.js'
import { Payment } from 'mercadopago'
import crypto from 'crypto'

import { sendOrderConfirmationEmail } from '../services/emailService.js'
import { createOrderEmailRecoveryService } from '../services/orderEmailRecoveryService.js'

// Dependencia real utilizada por la aplicación.
export const getMercadoPagoPayment = async (paymentId) => {
    return new Payment(client).get({ id: paymentId })
}

const validateSignature = (req) => {
    try {
        const signature = req.headers['x-signature']
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()

        if (!signature || !secret) return false

        const parts = signature.split(',').map((part) => part.trim())
        const ts = parts.find((part) => part.startsWith('ts='))?.split('=')[1]
        const hash = parts.find((part) => part.startsWith('v1='))?.split('=')[1]

        const xRequestId = req.headers['x-request-id']
        const rawDataId = req.query?.['data.id'] ?? req.body?.data?.id

        const dataId =
            typeof rawDataId === 'string' || typeof rawDataId === 'number'
                ? String(rawDataId)
                : null

        if (
            typeof dataId !== 'string' ||
            !dataId ||
            !xRequestId ||
            !ts ||
            !hash ||
            !/^[a-fA-F0-9]{64}$/.test(hash)
        ) {
            return false
        }

        const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`

        const expectedHash = crypto
            .createHmac('sha256', secret)
            .update(manifest)
            .digest('hex')

        return crypto.timingSafeEqual(
            Buffer.from(hash, 'hex'),
            Buffer.from(expectedHash, 'hex')
        )
    } catch {
        return false
    }
}

// Permite inyectar dependencias al crear controladores de prueba.
// La ruta normal utiliza Mercado Pago y Resend reales.
export const createWebHookController = ({
    getPayment = getMercadoPagoPayment,
    sendEmail = sendOrderConfirmationEmail,
    createEmailRecoveryService = createOrderEmailRecoveryService,
} = {}) => {
    return async (req, res) => {
        try {
            const type = req.body?.type || req.query.type

            if (type !== 'payment') {
                return res.status(200).json({
                    message: 'Notificación ignorada',
                })
            }

            if (!validateSignature(req)) {
                console.warn('Webhook rechazado:', {
                    tieneFirma: Boolean(req.headers['x-signature']),
                    tieneRequestId: Boolean(req.headers['x-request-id']),
                    tieneIdEnQuery: Boolean(req.query?.['data.id']),
                    tieneIdEnBody: Boolean(req.body?.data?.id),
                    tieneSecreto: Boolean(
                        process.env.MERCADOPAGO_WEBHOOK_SECRET
                    ),
                })

                return res.status(401).json({
                    message: 'Firma inválida',
                })
            }

            if (
                req.body?.data?.id != null &&
                req.query?.['data.id'] != null &&
                String(req.body.data.id) !== String(req.query['data.id'])
            ) {
                return res.status(400).json({
                    message: 'ID de pago inconsistente',
                })
            }

            const paymentId = String(
                req.query?.['data.id'] ?? req.body?.data?.id
            )
            const payment = await getPayment(paymentId)

            if (String(payment.id) !== String(paymentId)) {
                return res.status(400).json({
                    message: 'Pago inconsistente',
                })
            }

            const expectedCollectorId =
                process.env.MERCADOPAGO_COLLECTOR_ID?.trim()

            if (!expectedCollectorId) {
                console.error('Falta configurar MERCADOPAGO_COLLECTOR_ID')

                return res.status(500).json({
                    message: 'Configuración de pagos incompleta',
                })
            }

            if (String(payment.collector_id) !== expectedCollectorId) {
                console.warn('Webhook rechazado: receptor incorrecto')

                return res.status(400).json({
                    message:
                        'El pago no corresponde a nuestra cuenta receptora',
                })
            }

            const orderId = payment.external_reference

            if (
                typeof orderId !== 'string' ||
                !/^[a-fA-F0-9]{24}$/.test(orderId)
            ) {
                return res.status(400).json({
                    message: 'El pago no tiene una referencia de orden válida',
                })
            }

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

            // Pedido y stock se actualizan en una misma transacción.
            await OrderModel.db.transaction(async (session) => {
                const order =
                    await OrderModel.findById(orderId).session(session)

                if (!order) {
                    throw new Error('Orden no encontrada')
                }

                if (
                    order.status === 'approved' &&
                    order.mercadoPagoData?.paymentId &&
                    String(order.mercadoPagoData.paymentId) !==
                        String(payment.id)
                ) {
                    throw new Error('La orden ya fue aprobada con otro pago')
                }

                if (
                    payment.metadata?.order_id &&
                    String(payment.metadata.order_id) !== String(order._id)
                ) {
                    throw new Error('Metadata de orden inconsistente')
                }
                // Validar el importe incluso si el pedido ya está aprobado.
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
                }
                // Idempotencia: no descontar stock nuevamente.
                if (order.status === 'approved') {
                    console.log(
                        `Orden ${order._id} ya aprobada. No se modifica.`
                    )
                    return
                }

                if (payment.status === 'approved') {
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

                if (payment.status === 'approved') {
                    order.status = 'approved'
                    order.mercadoPagoData.paymentId = String(payment.id)
                    order.mercadoPagoData.paymentStatus = 'approved'
                    order.mercadoPagoData.transactionAmount =
                        payment.transaction_amount
                    order.mercadoPagoData.paymentMethodId =
                        payment.payment_method_id
                    order.mercadoPagoData.paidAt =
                        payment.date_approved || new Date()
                } else {
                    order.status = payment.status
                    order.mercadoPagoData.paymentStatus = payment.status
                }

                await order.save({ session })
            })

            // El servicio centralizado controla las reservas de correo.
            // No recupera automáticamente reservas antiguas ni pedidos
            // marcados para revisión.
            const emailRecovery = createEmailRecoveryService({
                sendEmail,
                orderId,
            })

            const emailResult = await emailRecovery.recoverOnePendingEmail()

            if (emailResult.needsReview) {
                console.warn(
                    'Correo de confirmación pendiente de revisión:',
                    orderId
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
}

// La aplicación utiliza el controlador con dependencias reales.
const webHookController = createWebHookController()

export default webHookController
