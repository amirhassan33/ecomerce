import express from 'express'
import {
    createOrder,
    getMyOrders,
    getAllOrders,
    getOrderById,
} from '../controllers/orderControllers.js'
import {
    authenticateUser,
    requireAdmin,
} from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/create', authenticateUser, createOrder)

router.get('/my-orders', authenticateUser, getMyOrders)

router.get(
    '/admin/all',
    authenticateUser,
    requireAdmin,
    getAllOrders
)

router.get('/:id', authenticateUser, getOrderById)

export default router