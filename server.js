const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dotenv = require("dotenv")
const path = require("path")
const helmet = require("helmet")
const mongoSanitize = require("express-mongo-sanitize")
const xss = require("xss-clean")
const rateLimit = require("express-rate-limit")
const hpp = require("hpp")
const compression = require("compression")
const morgan = require("morgan")

// Import routes
const authRoutes = require("./routes/auth")
const userRoutes = require("./routes/users")
const projectRoutes = require("./routes/projects")
const assignmentRoutes = require("./routes/assignments")
const engineerRoutes = require("./routes/engineers")
const analyticsRoutes = require("./routes/analytics")

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Trust proxy for rate limiting behind reverse proxy
app.set("trust proxy", 1)

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: (Number.parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000, // 15 minutes
  max: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(limiter)

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL || "http://localhost:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ]

      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true)

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(new Error("Not allowed by CORS"))
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Data sanitization against NoSQL query injection
app.use(mongoSanitize())

// Data sanitization against XSS
app.use(xss())

// Prevent parameter pollution
app.use(hpp())

// Compression middleware
app.use(compression())

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"))
} else {
  app.use(morgan("combined"))
}

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

// Database connection with retry logic
const connectDB = async () => {
  const maxRetries = 5
  let retries = 0

  while (retries < maxRetries) {
    try {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/engineering-resource-management", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      console.log("Connected to MongoDB")
      break
    } catch (error) {
      retries++
      console.error(`MongoDB connection attempt ${retries} failed:`, error.message)

      if (retries === maxRetries) {
        console.error("Max retries reached. Exiting...")
        process.exit(1)
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retries) * 1000))
    }
  }
}

// Connect to database
connectDB()

// Handle MongoDB connection events
mongoose.connection.on("error", (error) => {
  console.error("MongoDB connection error:", error)
})

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected")
})

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Received SIGINT. Graceful shutdown...")
  await mongoose.connection.close()
  process.exit(0)
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/projects", projectRoutes)
app.use("/api/assignments", assignmentRoutes)
app.use("/api/engineers", engineerRoutes)
app.use("/api/analytics", analyticsRoutes)

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Engineering Resource Management API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
  })
})

// API documentation endpoint
app.get("/api", (req, res) => {
  res.status(200).json({
    message: "Engineering Resource Management API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      projects: "/api/projects",
      assignments: "/api/assignments",
      engineers: "/api/engineers",
      analytics: "/api/analytics",
      health: "/api/health",
    },
    documentation: "https://your-docs-url.com",
  })
})

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("Error stack:", err.stack)

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = "Resource not found"
    return res.status(404).json({
      success: false,
      message,
    })
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = "Duplicate field value entered"
    return res.status(400).json({
      success: false,
      message,
    })
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ")
    return res.status(400).json({
      success: false,
      message,
    })
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    })
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
    })
  }

  // CORS errors
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "CORS policy violation",
    })
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  })
})

// 404 handler for undefined routes
// app.use("*", (req, res) => {
//   res.status(404).json({
//     success: false,
//     message: `Route ${req.originalUrl} not found`,
//   })
// })

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`)
  console.log(`🔗 API URL: http://localhost:${PORT}/api`)
  console.log(`💚 Health Check: http://localhost:${PORT}/api/health`)
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.error("Unhandled Promise Rejection:", err.message)
  // Close server & exit process
  server.close(() => {
    process.exit(1)
  })
})

module.exports = app
