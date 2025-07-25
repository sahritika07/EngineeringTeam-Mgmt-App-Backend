const mongoose = require("mongoose")

const AssignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Assignment title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Assignment description is required"],
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    project: {
      type: mongoose.Schema.ObjectId,
      ref: "Project",
      required: [true, "Project is required"],
    },
    assignee: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Assignee is required"],
    },
    assignedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Assigned by is required"],
    },
    status: {
      type: String,
      enum: ["pending", "active", "in-progress", "completed", "cancelled", "on-hold"],
      default: "active",
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
    estimatedHours: {
      type: Number,
      required: [true, "Estimated hours is required"],
      min: [0.5, "Estimated hours must be at least 0.5"],
    },
    actualHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    deadline: {
      type: Date,
      required: [true, "Assignment deadline is required"],
      validate: {
        validator: (value) => value > new Date(),
        message: "Deadline must be in the future",
      },
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    comments: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: "User",
          required: true,
        },
        text: {
          type: String,
          required: true,
          trim: true,
          maxlength: [500, "Comment cannot exceed 500 characters"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    timeEntries: [
      {
        date: {
          type: Date,
          required: true,
        },
        hours: {
          type: Number,
          required: true,
          min: [0.25, "Time entry must be at least 0.25 hours"],
          max: [24, "Time entry cannot exceed 24 hours"],
        },
        description: {
          type: String,
          trim: true,
          maxlength: [200, "Time entry description cannot exceed 200 characters"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
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

// Virtual for days until deadline
AssignmentSchema.virtual("daysUntilDeadline").get(function () {
  const now = new Date()
  const deadline = new Date(this.deadline)
  const diffTime = deadline - now
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Virtual for total logged hours
AssignmentSchema.virtual("totalLoggedHours").get(function () {
  return this.timeEntries.reduce((total, entry) => total + entry.hours, 0)
})

// Virtual for efficiency percentage
AssignmentSchema.virtual("efficiency").get(function () {
  if (this.estimatedHours === 0) return 0
  const loggedHours = this.totalLoggedHours
  return Math.round((this.estimatedHours / Math.max(loggedHours, this.estimatedHours)) * 100)
})

// Index for better query performance
AssignmentSchema.index({ project: 1 })
AssignmentSchema.index({ assignee: 1 })
AssignmentSchema.index({ status: 1 })
AssignmentSchema.index({ priority: 1 })
AssignmentSchema.index({ deadline: 1 })
AssignmentSchema.index({ assignedBy: 1 })

// Update actual hours when time entries change
AssignmentSchema.pre("save", function (next) {
  if (this.isModified("timeEntries")) {
    this.actualHours = this.timeEntries.reduce((total, entry) => total + entry.hours, 0)
  }

  // Auto-complete if progress is 100%
  if (this.progress === 100 && this.status !== "completed") {
    this.status = "completed"
    this.completedAt = new Date()
  }

  // Set status to in-progress if progress > 0 and status is pending/active
  if (this.progress > 0 && (this.status === "pending" || this.status === "active")) {
    this.status = "in-progress"
  }

  next()
})

// Update project progress after assignment changes
AssignmentSchema.post("save", async function () {
  const Project = mongoose.model("Project")
  const project = await Project.findById(this.project)
  if (project) {
    await project.updateProgress()
  }
})

module.exports = mongoose.model("Assignment", AssignmentSchema)
