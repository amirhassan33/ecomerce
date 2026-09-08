import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const sendOrderConfirmationEmail = async (order) => {
    const productsHtml = order.products
        .map(
            (product) => `
                <li>
                    ${product.name} — Cantidad: ${product.quantity}
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
                Hola ${order.shippingInfo.firstName},
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