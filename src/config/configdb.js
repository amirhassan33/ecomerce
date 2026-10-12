import mongoose from 'mongoose'

let pendingConnection = null

export const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection
    }

    if (pendingConnection) {
        return pendingConnection
    }

    pendingConnection = (async () => {
        const required = [
            'MONGO_DB_URI',
            'MONGO_DB_USER',
            'MONGO_DB_PASSWORD',
            'MONGO_DB_NAME',
        ]
        const missing = required.filter((key) => !process.env[key])
        if (missing.length) {
            throw new Error(
                `Faltan variables de MongoDB: ${missing.join(', ')}`
            )
        }

        const dbUri = process.env.MONGO_DB_URI.replace(
            '<db_username>',
            encodeURIComponent(process.env.MONGO_DB_USER)
        )
            .replace(
                '<db_password>',
                encodeURIComponent(process.env.MONGO_DB_PASSWORD)
            )
            .replace('<db_name>', process.env.MONGO_DB_NAME)

        await mongoose.connect(dbUri, {
            serverSelectionTimeoutMS: 8000,
            maxPoolSize: 10,
            bufferCommands: false,
        })
        return mongoose.connection
    })()

    try {
        return await pendingConnection
    } catch (error) {
        console.error('Error connecting to MongoDB:', error.message)
        throw error
    } finally {
        pendingConnection = null
    }
}

export const disconnectDB = async () => {
    pendingConnection = null
    await mongoose.disconnect()
}
