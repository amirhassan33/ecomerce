import mongoose from 'mongoose'

const ProductSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0.01,
        },
        stock: {
            type: Number,
            required: true,
            min: 0,
            validate: {
                validator: Number.isInteger,
                message: 'El stock debe ser un número entero',
            },
        },
        imageUrl: {
            type: String,
            required: true,
        },
        imagePublicId: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
)

export default mongoose.model('Product', ProductSchema)
