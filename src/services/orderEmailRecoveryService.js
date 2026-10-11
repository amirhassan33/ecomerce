
import OrderModel from '../models/OrderModel.js'
import { sendOrderConfirmationEmail } from './emailService.js'

const MAX_ATTEMPTS = 3
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000

export const createOrderEmailRecoveryService = ({
    sendEmail = sendOrderConfirmationEmail,
    orderId = null,
} = {}) => {

    const markStaleClaimForReview = async () => {
        const staleBefore = new Date(
            Date.now() - CLAIM_TIMEOUT_MS
        )

        const filter = {
            status: 'approved',
            confirmationEmailSentAt: null,
            confirmationEmailNeedsReview: { $ne: true },
            confirmationEmailClaimedAt: {
                $type: 'date',
                $lt: staleBefore,
            },
        }

        if (orderId) {
            filter._id = orderId
        }

        const order = await OrderModel.findOneAndUpdate(
            filter,
            {
                $set: {
                    confirmationEmailNeedsReview: true,
                },
                $unset: {
                    confirmationEmailClaimedAt: '',
                },
            },
            {
                new: true,
                sort: { createdAt: 1 },
            }
        )

        if (!order) {
            return {
                marked: false,
                reason: 'no_stale_claims',
            }
        }

        console.warn(
            'Reserva de correo abandonada; requiere revisión:',
            String(order._id)
        )

        return {
            marked: true,
            orderId: String(order._id),
        }
    }

    const recoverOnePendingEmail = async () => {
        const now = new Date()

        const filter = {
            status: 'approved',
            confirmationEmailSentAt: null,

            'shippingInfo.email': {
                $exists: true,
                $type: 'string',
                $ne: '',
            },

            $and: [
                {
                    $or: [
                        { confirmationEmailAttempts: { $lt: MAX_ATTEMPTS } },
                        { confirmationEmailAttempts: { $exists: false } },
                    ],
                },
                {
                    $or: [
                        { confirmationEmailClaimedAt: null },
                        { confirmationEmailClaimedAt: { $exists: false } },
                    ],
                },
                {
                    $or: [
                        { confirmationEmailNeedsReview: false },
                        { confirmationEmailNeedsReview: { $exists: false } },
                    ],
                },
            ],
        }

        if (orderId) {
            filter._id = orderId
        }

        const order = await OrderModel.findOneAndUpdate(
            filter,
            {
                $set: {
                    confirmationEmailClaimedAt: now,
                },
                $inc: {
                    confirmationEmailAttempts: 1,
                },
            },
            {
                new: true,
                sort: { createdAt: 1 },
            }
        )

        if (!order) {
            return {
                processed: false,
                reason: 'no_pending_orders',
            }
        }

        try {
            await sendEmail(order)

            const result = await OrderModel.updateOne(
                {
                    _id: order._id,
                    confirmationEmailClaimedAt: now,
                    confirmationEmailSentAt: null,
                },
                {
                    $set: {
                        confirmationEmailSentAt: new Date(),
                    },
                    $unset: {
                        confirmationEmailClaimedAt: '',
                    },
                }
            )

            if (result.modifiedCount !== 1) {
                throw new Error(
                    'No se pudo registrar el correo enviado'
                )
            }

            return {
                processed: true,
                sent: true,
                orderId: String(order._id),
            }
        } catch (error) {
            // Un fallo puede dejar un resultado incierto.
            // Marcamos el pedido para revisión manual.
            try {
                await OrderModel.updateOne(
                    {
                        _id: order._id,
                        confirmationEmailClaimedAt: now,
                        confirmationEmailSentAt: null,
                    },
                    {
                        $set: {
                            confirmationEmailNeedsReview: true,
                        },
                        $unset: {
                            confirmationEmailClaimedAt: '',
                        },
                    }
                )
            } catch (databaseError) {
                console.error(
                    'No se pudo registrar la revisión del correo:',
                    String(order._id),
                    databaseError.message
                )
                throw databaseError
            }

            console.error(
                'Correo pendiente de revisión:',
                String(order._id),
                error.message
            )

            return {
                processed: true,
                sent: false,
                needsReview: true,
                orderId: String(order._id),
            }
        }
    }

    return {
        markStaleClaimForReview,
        recoverOnePendingEmail,
    }
}

export const orderEmailRecoveryService =
    createOrderEmailRecoveryService()
