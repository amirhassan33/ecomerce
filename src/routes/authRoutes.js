import express from 'express'
import {
    registerUser,
    profile,
    loginUser,
    logout,
} from '../controllers/authControllers.js'

const router = express.Router()

router.post('/register', registerUser)

router.post('/login', loginUser)

router.post('/logout', logout)

router.get('/profile', profile)

export default router
