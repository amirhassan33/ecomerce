import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import UserModel from '../models/UserModel.js'
import {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
} from '../schemas/authSchema.js'
import { ZodError } from 'zod'
import { sendPasswordResetEmail } from '../services/emailService.js'

export const registerUser = async (req, res) => {
    try {
        const JWT_SECRET = process.env.JWT_SECRET
        const { username, email, password } = registerSchema.parse(req.body)
        const existingUser = await UserModel.findOne({ email })
        if (existingUser) {
            return res.status(400).json({ message: 'El usuario ya existe' })
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        const isFirsUser = (await UserModel.countDocuments()) === 0
        const newUser = await UserModel.create({
            username,
            email,
            password: hashedPassword,
            isAdmin: isFirsUser,
        })
        const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, {
            expiresIn: '1h',
        })

        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 60 * 60 * 1000,
        })

            .status(201)
            .json({ message: 'Usuario registrado con exito' })
    } catch (error) {
        if (error instanceof ZodError) {
            return res
                .status(400)
                .json(error.issues.map((issue) => ({ message: issue.message })))
        }

        return res.status(500).json({
            message: 'Error al registrar el usuario',
        })
    }
}

export const loginUser = async (req, res) => {
    try {
        const JWT_SECRET = process.env.JWT_SECRET
        const { email, password } = loginSchema.parse(req.body)
        const user = await UserModel.findOne({ email })
        if (!user) {
            return res.status(400).json({ message: 'Credenciales invalidas' })
        }
        const isPasswordValid = await bcrypt.compare(password, user.password)

        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Credenciales invalidas' })
        }

        const token = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            {
                expiresIn: '1h',
            }
        )

        const userData = {
            id: user._id,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin,
        }

        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 60 * 60 * 1000,
        })
            .status(200)
            .json(userData)
    } catch (error) {
        if (error instanceof ZodError) {
            return res
                .status(400)
                .json(error.issues.map((issue) => ({ message: issue.message })))
        }
        res.status(500).json({
            message: 'Error al iniciar sesion',
            error: error,
        })
    }
}

export const profile = async (req, res) => {
    const token = req.cookies.accessToken
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await UserModel.findById(decoded.userId)
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' })
        }
        res.status(200).json({
            id: user._id,
            email: user.email,
            isAdmin: user.isAdmin,
            username: user.username,
        })
    } catch (error) {
        res.status(401).json({ message: 'No autorizado' })
    }
    return {
        user: 'test user',
    }
}

export const logout = (req, res) => {
    res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    })
        .status(200)
        .json({ message: 'Cierre de sesion exitoso' })
}

export const forgotPassword = async (req, res) => {
    const genericMessage =
        'Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.'

    try {
        const { email } = forgotPasswordSchema.parse(req.body)
        const user = await UserModel.findOne({ email: email.toLowerCase() })

        if (!user) {
            return res.status(200).json({ message: genericMessage })
        }

        const resetToken = crypto.randomBytes(32).toString('hex')
        const resetPasswordTokenHash = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex')

        user.resetPasswordTokenHash = resetPasswordTokenHash
        user.resetPasswordExpiresAt = new Date(Date.now() + 15 * 60 * 1000)
        await user.save()

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`

        try {
            await sendPasswordResetEmail(user.email, resetUrl)
        } catch (error) {
            user.resetPasswordTokenHash = null
            user.resetPasswordExpiresAt = null
            await user.save()
            throw error
        }

        return res.status(200).json({ message: genericMessage })
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ message: error.issues[0].message })
        }

        console.error('Error al solicitar recuperación:', error.message)
        return res.status(500).json({
            message: 'No se pudo procesar la solicitud. Intentá nuevamente.',
        })
    }
}

export const resetPassword = async (req, res) => {
    try {
        const { password } = resetPasswordSchema.parse(req.body)
        const resetPasswordTokenHash = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex')

        const user = await UserModel.findOne({
            resetPasswordTokenHash,
            resetPasswordExpiresAt: { $gt: new Date() },
        }).select('+resetPasswordTokenHash +resetPasswordExpiresAt')

        if (!user) {
            return res.status(400).json({
                message: 'El enlace es inválido o venció. Solicitá uno nuevo.',
            })
        }

        user.password = await bcrypt.hash(password, 10)
        user.resetPasswordTokenHash = null
        user.resetPasswordExpiresAt = null
        await user.save()

        res.clearCookie('accessToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        })

        return res.status(200).json({
            message: 'Contraseña actualizada correctamente.',
        })
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ message: error.issues[0].message })
        }

        console.error('Error al restablecer contraseña:', error.message)
        return res.status(500).json({
            message: 'No se pudo restablecer la contraseña.',
        })
    }
}
