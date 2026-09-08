import express from 'express'
import {
    addToCart,
    getCart,
    updateCart,
    removeProductFromCart,
    clearCart,
    getCartTotal,
} from '../controllers/cartControllers.js'
import { authenticateUser } from '../middleware/authMiddleware.js'

const router = express.Router()

router.use(authenticateUser)

router.get('/get/:userId', getCart)
router.get('/total/:userId', getCartTotal)
router.put('/update/:userId', updateCart)
router.delete('/removeProduct/:userId', removeProductFromCart)
router.delete('/clear/:userId', clearCart)
router.post('/add', addToCart)

export default router