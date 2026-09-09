import express from 'express'
import {
    loginRateLimit,
    registerRateLimit,
} from '../middleware/authRateLimit.js'
import {
    registerUser,
    profile,
    loginUser,
    logout,
} from '../controllers/authControllers.js'

const router = express.Router()

router.post('/register', registerRateLimit, registerUser)

router.post('/login', loginRateLimit, loginUser)

router.post('/logout', logout)

router.get('/profile', profile)

export default router
