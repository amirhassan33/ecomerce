import rateLimit from 'express-rate-limit'

export const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        message:
            'Demasiados intentos de inicio de sesión. Intentá nuevamente en 15 minutos.',
    },
})

export const registerRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        message:
            'Se crearon demasiadas cuentas. Intentá nuevamente más tarde.',
    },
})
