import app from './app'
import prisma from './config/database'

const PORT = Number(process.env.PORT) || 8080

async function startServer() {
  try {
    await prisma.$connect()

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('========================================')
      console.log('✓ SERVER STARTED SUCCESSFULLY')
      console.log(`✓ Server is running on port ${PORT}`)
      console.log(`✓ Environment: ${process.env.NODE_ENV}`)
      console.log(`✓ Health check: http://localhost:${PORT}/health`)
      console.log('========================================')
    })

    server.on('error', (error: any) => {
      console.error('!!! SERVER ERROR:', error)
      if (error.code === 'EADDRINUSE') {
        console.error(`!!! Port ${PORT} is already in use`)
      }
    })

    server.on('close', () => {
      console.log('!!! SERVER CLOSED')
    })
  } catch (error) {
    console.error('!!! FAILED TO START SERVER:', error)
    process.exit(1)
  }
}

process.on('SIGINT', async () => {
  console.log('\n!!! SIGINT received - Shutting down gracefully...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n!!! SIGTERM received - Shutting down gracefully...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('uncaughtException', (error) => {
  console.error('!!! UNCAUGHT EXCEPTION:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('!!! UNHANDLED REJECTION at:', promise, 'reason:', reason)
  process.exit(1)
})

console.log('Calling startServer()...')
startServer()
