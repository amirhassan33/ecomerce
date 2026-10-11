import mongoose from 'mongoose'

const OrderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },

        products: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Product',
                    required: true,
                },
                name: String,
                price: {
                    type: Number,
                    required: true,
                    min: 0.01,
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                    validate: {
                        validator: Number.isInteger,
                        message: 'La cantidad debe ser un número entero',
                    },
                },
                imageUrl: String,
            },
        ],

        totalAmount: {
            type: Number,
            required: true,
            min: 0.01,
        },

        status: {
            type: String,
            enum: [
                'pending',
                'approved',
                'rejected',
                'cancelled',
                'in_process',
            ],
            default: 'pending',
        },

        // Control de correos de confirmación.
        confirmationEmailClaimedAt: {
            type: Date,
            default: null,
        },

        confirmationEmailSentAt: {
            type: Date,
            default: null,
        },

        confirmationEmailAttempts: {
            type: Number,
            default: 0,
            min: 0,
        },

        confirmationEmailNeedsReview: {
            type: Boolean,
            default: false,
        },

        shippingInfo: {
            firstName: {
                type: String,
                required: true,
            },
            lastName: {
                type: String,
                required: true,
            },
            email: String,
            phone: {
                type: String,
                required: true,
            },
            address: {
                street: {
                    type: String,
                    required: true,
                },
                number: {
                    type: String,
                    required: true,
                },
                city: {
                    type: String,
                    required: true,
                },
                state: {
                    type: String,
                    required: true,
                },
                zipCode: {
                    type: String,
                    required: true,
                },
            },
        },

        mercadoPagoData: {
            preferenceId: String,
            payerEmail: String,
            paymentId: String,
            paymentStatus: {
                type: String,
                enum: [
                    'pending',
                    'approved',
                    'rejected',
                    'cancelled',
                    'in_process',
                ],
                default: 'pending',
            },
            transactionAmount: Number,
            paymentMethodId: String,
            paidAt: Date,
        },
    },
    {
        timestamps: true,
    }
)

export default mongoose.model('Order', OrderSchema)
