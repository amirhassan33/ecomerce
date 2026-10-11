import 'dotenv/config'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const escapeHtml = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

export const sendOrderConfirmationEmail = async (order) => {
    const productsHtml = order.products
        .map(
            (product) => `
                <li>
                    ${escapeHtml(product.name)} — Cantidad: ${product.quantity}
                    — $${product.price.toLocaleString('es-AR')}
                </li>
            `
        )
        .join('')

    const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: order.shippingInfo.email,
        subject: `Pago aprobado - Pedido #${order._id}`,
        html: `
            <h1>¡Gracias por tu compra!</h1>

            <p>
                Hola ${escapeHtml(order.shippingInfo.firstName)},
                recibimos correctamente tu pago.
            </p>

            <h2>Productos</h2>
            <ul>${productsHtml}</ul>

            <p>
                <strong>
                    Total: $${order.totalAmount.toLocaleString('es-AR')}
                </strong>
            </p>

            <p>
                Tu número de pedido es:
                <strong>${order._id}</strong>
            </p>
        `,
    })

    if (error) {
        throw new Error(`Resend: ${error.message}`)
    }

    return data
}

export const sendPasswordResetEmail = async (email, resetUrl) => {
    const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Restablecer contraseña',
        html: `
            <h1>Restablecer contraseña</h1>
            <p>Recibimos una solicitud para cambiar tu contraseña.</p>
            <p>
                <a href="${escapeHtml(resetUrl)}">
                    Crear una nueva contraseña
                </a>
            </p>
            <p>Este enlace vence en 15 minutos y puede utilizarse una sola vez.</p>
            <p>Si no solicitaste este cambio, ignorá este correo.</p>
        `,
    })

    if (error) {
        throw new Error(`Resend: ${error.message}`)
    }

    return data
}
