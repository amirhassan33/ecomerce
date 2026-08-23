import express from 'express'
import {
    addToCart,
    getCart,
    updateCart,
    removeProductFromCart,
    clearCart,
    getCartTotal,
} from '../controllers/cartControllers.js'
const router = express.Router()

// Rutas que verificarn que el usuario accesa solo a su propio carrito
router.get('/get/:userId', getCart) // getCart

router.get('/total/:userId', getCartTotal) // getCartTotal

router.put('/update/:userId', updateCart) // updateCart

router.delete('/removeProduct/:userId', removeProductFromCart) // removeProductFromCart

router.delete('/clear/:userId', clearCart) // clearCart

// Ruta para agregar al carrito (no necesita userId)
router.post('/add', addToCart) // addToCart

export default router
