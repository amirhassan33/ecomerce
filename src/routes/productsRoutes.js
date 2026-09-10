import express from 'express'
import { authenticateUser, requireAdmin } from '../middleware/authMiddleware.js'
import {
    createProducts,
    deleteProduct,
    getAllProducts,
    getProductById,
    updateProduct,
} from '../controllers/productsControllers.js'
import { uploadProductImage } from '../middleware/uploadProductImage.js'
const router = express.Router()

router.get('/', getAllProducts)

router.get('/:id', getProductById)

router.post(
    '/',
    authenticateUser,
    requireAdmin,
    uploadProductImage,
    createProducts
)

router.put(
    '/:id',
    authenticateUser,
    requireAdmin,
    uploadProductImage,
    updateProduct
)

router.delete('/:id', authenticateUser, requireAdmin, deleteProduct)

export default router
