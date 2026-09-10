import { email, z } from 'zod'

const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/

export const registerSchema = z.object({
    username: z.string().min(3).max(20),
    email: z.email().min(6).max(254),
    password: z
        .string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres')
        .max(254)
        .regex(
            strongPassword,
            'La contraseña debe incluir una mayúscula, una minúscula, un número y un carácter especial'
        ),
})

export const loginSchema = z.object({
    email: z.email().min(6).max(254),
    password: z.string().min(6).max(254),
})

export const forgotPasswordSchema = z.object({
    email: z.email('El correo electrónico no es válido').max(254),
})

export const resetPasswordSchema = z.object({
    password: z
        .string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres')
        .max(254)
        .regex(
            strongPassword,
            'La contraseña debe incluir una mayúscula, una minúscula, un número y un carácter especial'
        ),
})
