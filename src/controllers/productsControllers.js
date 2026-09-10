import ProductModel from '../models/ProductModel.js'
import { productSchema } from '../schemas/productSchema.js'
import { ZodError } from 'zod'
import { deleteImage, uploadImage } from '../services/cloudinaryService.js'

const getProductData = (body) => ({
    name: body.name,
    description: body.description,
    price: Number(body.price),
    stock: Number(body.stock),
})

export const createProducts = async (req, res) => {
    let uploadedImage

    try {
        if (!req.file) {
            return res.status(400).json({
                message: 'Seleccioná una imagen para el producto',
            })
        }

        uploadedImage = await uploadImage(req.file.buffer)
        const productData = productSchema.parse({
            ...getProductData(req.body),
            imageUrl: uploadedImage.secure_url,
        })

        const product = await ProductModel.create({
            ...productData,
            imagePublicId: uploadedImage.public_id,
        })
        return res
            .status(201)
            .json({ message: 'Producto creado exitosamente', product })
    } catch (error) {
        if (uploadedImage?.public_id) {
            await deleteImage(uploadedImage.public_id).catch(() => {})
        }

        if (error instanceof ZodError) {
            return res
                .status(400)
                .json(error.issues.map((issue) => ({ message: issue.message })))
        }

        return res.status(500).json({ message: 'Error al crear el producto' })
    }
}

export const updateProduct = async (req, res) => {
    let uploadedImage

    try {
        const currentProduct = await ProductModel.findById(req.params.id)

        if (!currentProduct) {
            return res.status(404).json({ message: 'Producto no encontrado' })
        }

        const validateData = productSchema.partial().parse(
            getProductData(req.body)
        )

        if (req.file) {
            uploadedImage = await uploadImage(req.file.buffer)
            validateData.imageUrl = uploadedImage.secure_url
            validateData.imagePublicId = uploadedImage.public_id
        }

        const updatedProduct = await ProductModel.findByIdAndUpdate(
            req.params.id,
            validateData,
            { new: true, runValidators: true }
        )
        if (!updatedProduct) {
            return res.status(404).json({ message: 'Producto no encontrado' })
        }

        if (uploadedImage && currentProduct.imagePublicId) {
            await deleteImage(currentProduct.imagePublicId).catch((error) => {
                console.error('No se pudo eliminar la imagen anterior:', error.message)
            })
        }

        return res.status(200).json(updatedProduct)
    } catch (error) {
        if (uploadedImage?.public_id) {
            await deleteImage(uploadedImage.public_id).catch(() => {})
        }

        if (error instanceof ZodError) {
            return res
                .status(400)
                .json(error.issues.map((issue) => ({ message: issue.message })))
        }

        return res.status(500).json({ message: 'Error al actualizar producto' })
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

        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' })
        }

        if (product.imagePublicId) {
            await deleteImage(product.imagePublicId).catch((error) => {
                console.error('No se pudo eliminar la imagen:', error.message)
            })
        }

        return res.status(200).json(product)
    } catch (error) {
        return res
            .status(500)
            .json({ message: 'Error al eliminar el producto' })
    }
}
