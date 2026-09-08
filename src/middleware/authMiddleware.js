import jwt from 'jsonwebtoken'
import UserModel from '../models/UserModel.js'

export const authenticateUser = async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Debes iniciar sesión',
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const user = await UserModel.findById(decoded.userId).select(
            '_id username email isAdmin'
        )

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'El usuario de la sesión no existe',
            })
        }

        req.user = user
        next()
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'La sesión es inválida o ha expirado',
        })
    }
}

export const requireAdmin = (req, res, next) => {
    if (!req.user?.isAdmin) {
        return res.status(403).json({
            success: false,
            message: 'No tienes permisos de administrador',
        })
    }

    next()
}