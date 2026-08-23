import express from 'express'
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

router.post('/', createProducts)

router.put('/:id', updateProduct)

router.delete('/:id', deleteProduct)

export default router
