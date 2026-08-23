import { email, z } from 'zod'

export const registerSchema = z.object({
    username: z.string().min(3).max(20),
    email: z.email().min(6).max(254),
    password: z.string().min(6).max(254),
})

export const loginSchema = z.object({
    email: z.email().min(6).max(254),
    password: z.string().min(6).max(254),
})
