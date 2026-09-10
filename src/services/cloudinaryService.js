import configureCloudinary from '../config/cloudinaryConfig.js'

export const uploadImage = (buffer) => {
    const cloudinary = configureCloudinary()

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: 'ecommerce-products',
                resource_type: 'image',
                transformation: [
                    {
                        width: 1200,
                        height: 1200,
                        crop: 'limit',
                        quality: 'auto',
                    },
                ],
            },
            (error, result) => {
                if (error) return reject(error)
                resolve(result)
            }
        )

        stream.end(buffer)
    })
}

export const deleteImage = async (publicId) => {
    if (!publicId) return
    const cloudinary = configureCloudinary()
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
}
