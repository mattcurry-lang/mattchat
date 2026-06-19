require('dotenv').config()
const express = require('express')
const cors = require('cors')
const emailRoutes = require('./routes/email')
const webhookRoutes = require('./routes/webhook')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'Mattchat API' }))

app.use('/email', emailRoutes)
app.use('/webhook', webhookRoutes)

app.listen(PORT, () => {
  console.log(`Mattchat backend running on port ${PORT}`)
})
