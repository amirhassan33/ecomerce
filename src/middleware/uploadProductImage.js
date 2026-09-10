import multer from 'multer'

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
    },
    fileFilter: (req, file, callback) => {
        if (!allowedTypes.includes(file.mimetype)) {
            return callback(
                new Error('La imagen debe ser JPG, PNG o WebP')
            )
        }

        callback(null, true)
    },
})

export const uploadProductImage = (req, res, next) => {
    upload.single('image')(req, res, (error) => {
        if (!error) return next()

        const message =
            error.code === 'LIMIT_FILE_SIZE'
                ? 'La imagen no puede superar los 5 MB'
                : error.message

        return res.status(400).json({ message })
    })
}
