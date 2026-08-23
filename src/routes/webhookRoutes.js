import express from 'express'
import webHookController from '../controllers/webHookControllers.js'

const router = express.Router()

router.post('/', webHookController)

export default router
