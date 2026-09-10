import express from 'express'
import {
    loginRateLimit,
    registerRateLimit,
    passwordResetRateLimit,
} from '../middleware/authRateLimit.js'
import {
    registerUser,
    profile,
    loginUser,
    logout,
    forgotPassword,
    resetPassword,
} from '../controllers/authControllers.js'

const router = express.Router()

router.post('/register', registerRateLimit, registerUser)

router.post('/login', loginRateLimit, loginUser)

router.post('/logout', logout)

router.get('/profile', profile)

router.post('/forgot-password', passwordResetRateLimit, forgotPassword)

router.post('/reset-password/:token', passwordResetRateLimit, resetPassword)

export default router
