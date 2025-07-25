const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "manager", "engineer"],
      default: "engineer",
    },
    department: {
      type: String,
      enum: ["Frontend", "Backend", "Full Stack", "DevOps", "AI/ML", "Mobile", "QA", "Design"],
      required: [true, "Department is required"],
    },
    experienceLevel: {
      type: String,
      enum: ["junior", "mid", "senior", "lead", "principal"],
      default: "junior",
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    hourlyRate: {
      type: Number,
      min: [0, "Hourly rate cannot be negative"],
    },
    availability: {
      type: Number,
      default: 40,
      min: [1, "Availability must be at least 1 hour"],
      max: [60, "Availability cannot exceed 60 hours per week"],
    },
    location: {
      type: String,
      trim: true,
      maxlength: [100, "Location cannot exceed 100 characters"],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[+]?[1-9][\d]{0,15}$/, "Please enter a valid phone number"],
    },
    avatar: {
      type: String,
      default: "/placeholder.svg?height=64&width=64",
    },
    utilization: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    efficiency: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual for full name
UserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`
})

// Virtual for current projects count
UserSchema.virtual("currentProjectsCount", {
  ref: "Assignment",
  localField: "_id",
  foreignField: "assignee",
  count: true,
  match: { status: { $in: ["active", "in-progress"] } },
})

// Index for better query performance
UserSchema.index({ email: 1 })
UserSchema.index({ role: 1 })
UserSchema.index({ department: 1 })
UserSchema.index({ isActive: 1 })

// Check if account is locked
UserSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now())
})

// Encrypt password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next()
  }

  const salt = await bcrypt.genSalt(Number.parseInt(process.env.BCRYPT_ROUNDS) || 12)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  })
}

// Update last login
UserSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date()
  this.loginAttempts = 0
  this.lockUntil = undefined
  await this.save({ validateBeforeSave: false })
}

// Increment login attempts
UserSchema.methods.incLoginAttempts = async function () {
  const maxAttempts = Number.parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5
  const lockoutTime = Number.parseInt(process.env.LOCKOUT_TIME) || 30 // minutes

  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 },
    })
  }

  const updates = { $inc: { loginAttempts: 1 } }

  // If we have hit max attempts and it's not locked already, lock the account
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockoutTime * 60 * 1000 }
  }

  return this.updateOne(updates)
}

module.exports = mongoose.model("User", UserSchema)
