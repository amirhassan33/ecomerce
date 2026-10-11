import mongoose from 'mongoose'

export const connectDB = async () => {
    try {
        const dbUri = process.env.MONGO_DB_URI.replace(
            '<db_username>',
            process.env.MONGO_DB_USER
        )
            .replace('<db_password>', process.env.MONGO_DB_PASSWORD)
            .replace('<db_name>', process.env.MONGO_DB_NAME)

        await mongoose.connect(dbUri)

        console.log('Connected to MongoDB')
        console.log(
            'Base utilizada por el servidor:',
            mongoose.connection.db.databaseName
        )
    } catch (error) {
        console.error('Error connecting to MongoDB:', error.message)

        // Impide que el servidor continúe si falla la conexión.
        throw error
    }
}

export const disconnectDB = async () => {
    try {
        await mongoose.disconnect()
        console.log('Base de datos MongoDB desconectada')
    } catch (error) {
        console.error('Error al desconectar MongoDB:', error)
    }
}
