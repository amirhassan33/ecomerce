import express from 'express'
import { authenticateUser, requireAdmin } from '../middleware/authMiddleware.js'
import {
    createProducts,
    deleteProduct,
    getAllProducts,
    getProductById,
    updateProduct,
} from '../controllers/productsControllers.js'
const router = express.Router()

router.get('/', getAllProducts)

router.get('/:id', getProductById)

router.post('/', authenticateUser, requireAdmin, createProducts)

router.put('/:id', authenticateUser, requireAdmin, updateProduct)

router.delete('/:id', authenticateUser, requireAdmin, deleteProduct)

export default router
