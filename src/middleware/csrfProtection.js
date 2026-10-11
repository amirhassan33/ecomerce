const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export const csrfProtection = (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
        return next()
    }

    // Mercado Pago utiliza una firma propia para autenticar su webhook.
    if (req.path === '/api/webhook' || req.path.startsWith('/api/webhook/')) {
        return next()
    }

    // Esta ruta interna utiliza autenticación mediante Bearer token.
    if (
        req.path === '/api/internal/email-recovery' ||
        req.path.startsWith('/api/internal/email-recovery/')
    ) {
        return next()
    }

    const allowedOrigin = process.env.FRONTEND_URL
    const requestOrigin = req.get('Origin')

    if (!allowedOrigin) {
        return res.status(503).json({
            success: false,
            message: 'Configuración de seguridad no disponible',
        })
    }

    if (!requestOrigin || requestOrigin !== allowedOrigin) {
        return res.status(403).json({
            success: false,
            message: 'Origen de solicitud no autorizado',
        })
    }

    next()
}
