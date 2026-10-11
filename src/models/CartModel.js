import mongoose from 'mongoose'

const CartSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false, // null si el usuario es invitado
        },
        products: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Product',
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    default: 1,
                    min: 1,
                    validate: {
                        validator: Number.isInteger,
                        message: 'La cantidad debe ser un número entero',
                    },
                },
            },
        ],
    },
    { timestamps: true }
)

export default mongoose.model('Cart', CartSchema)
