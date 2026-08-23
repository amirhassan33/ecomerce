import ProductModel from '../models/ProductModel.js'
import { productSchema } from '../schemas/productSchema.js'
import { ZodError } from 'zod'

export const createProducts = async (req, res) => {
    try {
        const { name, description, price, stock, imageUrl } =
            productSchema.parse(req.body)

        const product = await ProductModel.create({
            name,
            description,
            price,
            stock,
            imageUrl,
        })
        return res
            .status(201)
            .json({ message: 'Producto creado exitosamente', product })
    } catch (error) {
        if (error instanceof ZodError) {
            return res
                .status(400)
                .json(error.issues.map((issue) => ({ message: issue.message })))
        }

        return res.status(500).json({ message: 'Error al crear el producto' })
    }
}

export const updateProduct = async (req, res) => {
    try {
        const validateData = productSchema.partial().parse(req.body)
        const updatedProduct = await ProductModel.findByIdAndUpdate(
            req.params.id,
            validateData,
            { new: true, runValidators: true }
        )
        if (!updateProduct) {
            return res.status(404).json({ message: 'Producto no encontrado' })
        }
        return res.status(200).json(updatedProduct)
    } catch (error) {
        res.json({ message: 'Error al actualizar producto' })
    }
}

export const getProductById = async (req, res) => {
    try {
        const product = await ProductModel.findById(req.params.id)
        return res.status(200).json(product)
    } catch (error) {
        return res.status(500).json({ message: 'Error al obtener el producto' })
    }
}

export const getAllProducts = async (req, res) => {
    try {
        const products = await ProductModel.find()
        return res.status(200).json(products)
    } catch (error) {
        return res
            .status(500)
            .json({ message: 'Error al obtener los productos' })
    }
}

export const deleteProduct = async (req, res) => {
    try {
        const product = await ProductModel.findByIdAndDelete(req.params.id)
        return res.status(200).json(product)
    } catch (error) {
        return res
            .status(500)
            .json({ message: 'Error al eliminar el producto' })
    }
}
