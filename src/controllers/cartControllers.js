import CartModel from '../models/CartModel.js'
import ProductModel from '../models/ProductModel.js' // Tenemos que validar que el producto exista

export const addToCart = async (req, res) => {
    try {
        const userId = req.user?._id || req.body.userId
        const { productId, quantity = 1 } = req.body

        if (!userId) {
            return res.status(400).json({ message: 'El userId es requerido' })
        }

        // Validaciones
        if (!productId) {
            return res
                .status(400)
                .json({ message: 'El productId es requerido' })
        }

        if (quantity < 1) {
            return res
                .status(400)
                .json({ message: 'La cantidad debe ser al menos de 1' })
        }

        // Verificar que el producto exista
        const product = await ProductModel.findById(productId)

        if (!product) {
            return res.status(400).json({ message: 'Producto no econtrado' })
        }

        // Buscar carrito del usuario
        let cart = await CartModel.findOne({ userId })

        if (cart) {
            console.log('USUARIO YA TIENE CARRITO')
            // Si ya existe el carrito, busca el producto

            // Si ya existe, buacamos el producto
            const productIndex = cart.products.findIndex(
                (p) => p.productId.toString() === productId
            )

            // Verificar el stock
            if (product.stock < quantity) {
                return res.status(400).json({
                    message: `Solo hay ${product.stock} de unidades disponibles`,
                })
            }

            // QUE HAY COINCIDENCIA
            if (productIndex > -1) {
                // PRODUCTO YA EXISTE EN CARRITO DEL USUARIO, SOLO ACTUALIZAR LA CANTIDAD
                cart.products[productIndex].quantity += quantity
            } else {
                console.log('USUARIO NO TIENE CARRITO')

                // NUEVO PRODUCTO AGREGADO AL CARRITO
                cart.products.push({ productId, quantity })
            }
        } else {
            // Si no existe el carrito
            cart = new CartModel({
                userId,
                products: [{ productId, quantity }],
            })
        }

        // GUARDAR EL CARRITO DE COMPRAS
        await cart.save()

        // OPCIONAL
        await cart.populate('products.productId')

        // DEVOLVEMOS EL CARRITO ACTUALIZA
        res.status(200).json({
            message: 'Producto agregado al carrito',
            cart,
        })
    } catch (error) {
        res.json({ message: 'ERROR' })
    }
}

export const getCart = async (req, res) => {
    try {
        const { userId } = req.params

        const cart = await CartModel.findOne({ userId }).populate(
            'products.productId'
        )

        if (cart) {
            res.status(200).json({
                message: 'Carrito obtenido con éxito',
                cart,
            })
        } else {
            res.status(404).json({ message: 'Carrito no econtrado' })
        }
    } catch (error) {
        res.status(500).json({
            message: 'Error del servidor al obtener el carrito',
            error: error.message,
        })
    }
}

export const updateCart = async (req, res) => {
    try {
        const { userId } = req.params
        const { productId, quantity } = req.body
        console.log('UPDATE CART', productId, quantity)

        const cart = await CartModel.findOne({ userId })

        if (!cart) {
            return res.status(404).json({ message: 'Carrito no econtrado' })
        }

        const productIndex = cart.products.findIndex(
            (p) => p.productId.toString() === productId
        )

        if (productIndex > -1) {
            const product = await ProductModel.findById(productId)

            if (!product) {
                return res.status(404).json({
                    message: 'Producto no econtrado',
                })
            }

            // Verificar que la cantidad no exceda el stock disponible
            if (quantity > product.stock) {
                return res.status(400).json({
                    message: `Solo hay ${product.stock} unidades disponibles`,
                })
            }

            cart.products[productIndex].quantity = quantity

            await cart.save()

            res.status(200).json({
                message: 'Carrito actualizado con éxito',
                cart,
            })
        } else {
            res.status(404).json({
                message: 'Producto no econtrado en el carrito',
            })
        }
    } catch (error) {
        res.status(500).json({
            message: 'Error del servidor al actualizar el carrito',
            error: error.message,
        })
    }
}

export const removeProductFromCart = async (req, res) => {
    try {
        const { userId } = req.params
        const { productId } = req.body

        // Validar que se proporcionó el producId
        if (!userId) {
            return res.status(400).json({ message: 'El userId es requerido' })
        }

        // Validar que el carrito existe
        const cart = await CartModel.findOne({ userId })

        if (!cart) {
            return res.status(404).json({ message: 'Carrito no encontrado' })
        }

        // Buscar el indice del producto en el carrito
        const productIndex = cart.products.findIndex(
            (p) => p.productId.toString() === productId
        )

        // Verificar si el producto existe en el carrito
        if (productIndex > -1) {
            // Eliminar el producto del carrito
            cart.products.splice(productIndex, 1)

            // Guardad cambios en el carrito
            await cart.save()

            // Devolver el carrito actualizado
            res.status(200).json({
                message: 'Producto eliminado del carrito con éxito',
                cart,
            })
        } else {
            res.status(404).json({
                message: 'Producto no encontrado en el carrito',
            })
        }
    } catch (error) {
        res.status(500).json({
            message: 'Error del servidor al eliminar el producto del carrito',
        })
    }
}

export const clearCart = async (req, res) => {
    try {
        const { userId } = req.params

        const cart = await CartModel.findOne({ userId })

        if (cart) {
            cart.products = []
            await cart.save()
            res.status(200).json({
                message: 'Carrito vaciado con éxito',
                cart,
            })
        } else {
            res.status(404).json({
                message: 'Carrito no encontrado',
            })
        }
    } catch (error) {
        res.status(500).json({
            message: 'Error del servidor al eliminar un producto',
        })
    }
}

export const getCartTotal = async (req, res) => {
    try {
        const userId = req.user?._id || req.params.userId

        if (!userId) {
            return res.status(400).json({
                message: 'El userId es requerid',
            })
        }

        const cart = await CartModel.findOne({ userId }).populate(
            'products.productId'
        )

        if (!cart) {
            return res.status(404).json({
                message: 'Carrito no encontrado',
            })
        }

        if (cart) {
            const total = cart.products.reduce((acc, item) => {
                return acc + item.productId.price * item.quantity
            }, 0)

            res.status(200).json({
                message: 'Total obtenido con éxito',
                total,
            })
        } else {
            res.status(404).json({ message: 'Carrito no encontrado' })
        }
    } catch (error) {
        res.status(500).json({
            message: 'Error del servidor al obtener el total',
        })
    }
}
