import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

import { uploadProductImage } from '../src/middleware/uploadProductImage.js'

const withTestServer = async (callback) => {
    const app = express()

    app.post('/upload', uploadProductImage, (req, res) => {
        res.status(200).json({
            ok: true,
            hasFile: Boolean(req.file),
        })
    })

    const server = app.listen(0)

    try {
        await new Promise((resolve) => {
            server.once('listening', resolve)
        })

        const address = server.address()
        const url = `http://127.0.0.1:${address.port}/upload`

        return await callback(url)
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error)
                else resolve()
            })
        })
    }
}
test('Una solicitud sin imagen pasa correctamente por Multer', async () => {
    await withTestServer(async (url) => {
        const form = new FormData()

        const response = await fetch(url, {
            method: 'POST',
            body: form,
        })

        const result = await response.json()

        assert.equal(response.status, 200)
        assert.equal(result.ok, true)
        assert.equal(result.hasFile, false)

        console.log('Estado HTTP:', response.status)
        console.log('Imagen recibida:', result.hasFile)
    })
})
test('Multer acepta una imagen PNG válida', async () => {
    await withTestServer(async (url) => {
        const form = new FormData()

        const image = new Blob([Buffer.from('imagen simulada para prueba')], {
            type: 'image/png',
        })

        form.append('image', image, 'producto.png')

        const response = await fetch(url, {
            method: 'POST',
            body: form,
        })

        const result = await response.json()

        assert.equal(response.status, 200)
        assert.equal(result.ok, true)
        assert.equal(result.hasFile, true)

        console.log('Estado HTTP:', response.status)
        console.log('Imagen recibida:', result.hasFile)
    })
})
test('Multer rechaza un archivo con tipo no permitido', async () => {
    await withTestServer(async (url) => {
        const form = new FormData()

        const file = new Blob([Buffer.from('contenido simulado')], {
            type: 'text/plain',
        })

        form.append('image', file, 'archivo.txt')

        const response = await fetch(url, {
            method: 'POST',
            body: form,
        })

        const result = await response.json()

        assert.equal(response.status, 400)
        assert.equal(result.message, 'La imagen debe ser JPG, PNG o WebP')

        console.log('Estado HTTP:', response.status)
        console.log('Mensaje:', result.message)
    })
})
test('Multer rechaza imágenes que superan los 5 MB', async () => {
    await withTestServer(async (url) => {
        const form = new FormData()

        const image = new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], {
            type: 'image/png',
        })

        form.append('image', image, 'imagen-grande.png')

        const response = await fetch(url, {
            method: 'POST',
            body: form,
        })

        const result = await response.json()

        assert.equal(response.status, 400)
        assert.equal(result.message, 'La imagen no puede superar los 5 MB')

        console.log('Estado HTTP:', response.status)
        console.log('Mensaje:', result.message)
    })
})
test('Multer rechaza una solicitud con dos imágenes', async () => {
    await withTestServer(async (url) => {
        const form = new FormData()

        const image = new Blob([Buffer.from('imagen simulada')], {
            type: 'image/png',
        })

        form.append('image', image, 'producto-1.png')
        form.append('image', image, 'producto-2.png')

        const response = await fetch(url, {
            method: 'POST',
            body: form,
        })

        const result = await response.json()

        assert.equal(response.status, 400)
        assert.equal(typeof result.message, 'string')

        console.log('Estado HTTP:', response.status)
        console.log('Mensaje:', result.message)
    })
})
