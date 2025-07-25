const mongoose = require("mongoose")

const ProjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      maxlength: [100, "Project name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Project description is required"],
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: ["planning", "active", "on-hold", "completed", "cancelled"],
      default: "planning",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    deadline: {
      type: Date,
      required: [true, "Project deadline is required"],
      validate: {
        validator: (value) => value > new Date(),
        message: "Deadline must be in the future",
      },
    },
    budget: {
      type: Number,
      required: [true, "Project budget is required"],
      min: [0, "Budget cannot be negative"],
    },
    budgetUsed: {
      type: Number,
      default: 0,
      min: [0, "Budget used cannot be negative"],
    },
    manager: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Project manager is required"],
    },
    teamMembers: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          required: true,
          trim: true,
        },
        hoursPerWeek: {
          type: Number,
          default: 40,
          min: 1,
          max: 60,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    technologies: [
      {
        type: String,
        trim: true,
      },
    ],
    milestones: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        description: String,
        dueDate: Date,
        status: {
          type: String,
          enum: ["pending", "in-progress", "completed"],
          default: "pending",
        },
        completedAt: Date,
      },
    ],
    attachments: [
      {
        filename: String,
        originalName: String,
        path: String,
        size: Number,
        uploadedBy: {
          type: mongoose.Schema.ObjectId,
          ref: "User",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual for team size
ProjectSchema.virtual("teamSize").get(function () {
  return this.teamMembers.length
})

// Virtual for budget remaining
ProjectSchema.virtual("budgetRemaining").get(function () {
  return this.budget - this.budgetUsed
})

// Virtual for days until deadline
ProjectSchema.virtual("daysUntilDeadline").get(function () {
  const now = new Date()
  const deadline = new Date(this.deadline)
  const diffTime = deadline - now
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Virtual populate assignments
ProjectSchema.virtual("assignments", {
  ref: "Assignment",
  localField: "_id",
  foreignField: "project",
})

// Index for better query performance
ProjectSchema.index({ status: 1 })
ProjectSchema.index({ priority: 1 })
ProjectSchema.index({ manager: 1 })
ProjectSchema.index({ deadline: 1 })
ProjectSchema.index({ "teamMembers.user": 1 })

// Update progress based on assignments
ProjectSchema.methods.updateProgress = async function () {
  const Assignment = mongoose.model("Assignment")
  const assignments = await Assignment.find({ project: this._id })

  if (assignments.length === 0) {
    this.progress = 0
  } else {
    const totalProgress = assignments.reduce((sum, assignment) => sum + assignment.progress, 0)
    this.progress = Math.round(totalProgress / assignments.length)
  }

  await this.save({ validateBeforeSave: false })
}

// Pre-save middleware to update status based on progress
ProjectSchema.pre("save", function (next) {
  if (this.progress === 100 && this.status !== "completed") {
    this.status = "completed"
  } else if (this.progress > 0 && this.status === "planning") {
    this.status = "active"
  }
  next()
})

module.exports = mongoose.model("Project", ProjectSchema)
