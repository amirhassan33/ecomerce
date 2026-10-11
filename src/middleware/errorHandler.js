export const errorHandler = (err, req, res, next) => {
    console.error('Error interno del servidor:', err.message)

    if (res.headersSent) {
        return next(err)
    }

    return res.status(500).json({
        message: 'Ocurrió un error interno del servidor',
    })
}
