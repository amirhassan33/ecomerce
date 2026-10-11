
import {
    orderEmailRecoveryService,
} from '../services/orderEmailRecoveryService.js'

export const createEmailRecoveryController = ({
    recoveryService = orderEmailRecoveryService,
} = {}) => {
    return async (req, res) => {
        try {
            const result =
                await recoveryService.markStaleClaimForReview()

            return res.status(200).json({
                message: 'Revisión de reservas completada',
                result,
            })
        } catch (error) {
            console.error(
                'Error al revisar reservas de correo:',
                error.message
            )

            return res.status(500).json({
                message: 'No se pudo revisar las reservas de correo',
            })
        }
    }
}

export default createEmailRecoveryController()
