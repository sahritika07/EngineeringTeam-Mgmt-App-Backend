const express = require("express")
const Assignment = require("../models/Assignment")
const Project = require("../models/Project")
const User = require("../models/User")
const { protect, authorize, isAdminOrManager } = require("../middleware/auth")

const router = express.Router()


// @desc    Get all assignments
// @route   GET /api/assignments
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const query = {}

    // If user is engineer, only show their assignments
    if (req.user.role === "engineer") {
      query.assignee = req.user.id
    }

    // If user is manager, show assignments for their projects
    if (req.user.role === "manager") {
      const managerProjects = await Project.find({ manager: req.user.id }).select("_id")
      const projectIds = managerProjects.map((p) => p._id)
      query.project = { $in: projectIds }
    }

    // Filter by status if provided
    if (req.query.status) {
      query.status = req.query.status
    }

    // Filter by project if provided
    if (req.query.project) {
      query.project = req.query.project
    }

    // Filter by assignee if provided
    if (req.query.assignee) {
      query.assignee = req.query.assignee
    }

    const assignments = await Assignment.find(query)
      .populate("project", "name description status priority")
      .populate("assignee", "firstName lastName email department experienceLevel")
      .populate("assignedBy", "firstName lastName email")
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments,
    })
  } catch (error) {
    console.error("Get assignments error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Get single assignment
// @route   GET /api/assignments/:id
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate("project", "name description status priority manager")
      .populate("assignee", "firstName lastName email department experienceLevel skills")
      .populate("assignedBy", "firstName lastName email")
      .populate("comments.user", "firstName lastName email avatar")

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      })
    }

    // Check if user has access to this assignment
    if (req.user.role === "engineer" && assignment.assignee._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this assignment",
      })
    }

    res.status(200).json({
      success: true,
      data: assignment,
    })
  } catch (error) {
    console.error("Get assignment error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Create new assignment
// @route   POST /api/assignments
// @access  Private (Admin/Manager)
router.post("/", protect, isAdminOrManager, async (req, res) => {
  try {
    const { title, description, project, assignee, priority, estimatedHours, deadline, tags } = req.body

    // Verify project exists
    const projectExists = await Project.findById(project)
    if (!projectExists) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      })
    }

    // Verify assignee exists and is an engineer
    const assigneeUser = await User.findById(assignee)
    if (!assigneeUser) {
      return res.status(404).json({
        success: false,
        message: "Assignee not found",
      })
    }

    // Check if manager is trying to assign to a project they don't manage
    if (req.user.role === "manager" && projectExists.manager.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only create assignments for projects you manage",
      })
    }

    const assignment = await Assignment.create({
      title,
      description,
      project,
      assignee,
      assignedBy: req.user.id,
      priority: priority || "medium",
      estimatedHours,
      deadline,
      tags: tags || [],
    })

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate("project", "name description")
      .populate("assignee", "firstName lastName email department")
      .populate("assignedBy", "firstName lastName email")

    res.status(201).json({
      success: true,
      message: "Assignment created successfully",
      data: populatedAssignment,
    })
  } catch (error) {
    console.error("Create assignment error:", error)

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message)
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: messages,
      })
    }

    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Update assignment
// @route   PUT /api/assignments/:id
// @access  Private
// router.put("/:id", protect, async (req, res) => {
//   try {
//     let assignment = await Assignment.findById(req.params.id)

//     if (!assignment) {
//       return res.status(404).json({
//         success: false,
//         message: "Assignment not found",
//       })
//     }

//     // Check permissions
//     const canUpdate =
//       req.user.role === "admin" ||
//       assignment.assignedBy.toString() === req.user.id ||
//       assignment.assignee.toString() === req.user.id

//     if (!canUpdate) {
//       return res.status(403).json({
//         success: false,
//         message: "Not authorized to update this assignment",
//       })
//     }

//     // Engineers can only update certain fields
//     if (req.user.role === "engineer") {
//       const allowedFields = ["progress", "status", "actualHours"]
//       const updateFields = {}

//       allowedFields.forEach((field) => {
//         if (req.body[field] !== undefined) {
//           updateFields[field] = req.body[field]
//         }
//       })

//       assignment = await Assignment.findByIdAndUpdate(req.params.id, updateFields, { new: true, runValidators: true })
//         .populate("project", "name description")
//         .populate("assignee", "firstName lastName email department")
//         .populate("assignedBy", "firstName lastName email")
//     } else {
//       // Admins and managers can update all fields
//       assignment = await Assignment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
//         .populate("project", "name description")
//         .populate("assignee", "firstName lastName email department")
//         .populate("assignedBy", "firstName lastName email")
//     }

//     res.status(200).json({
//       success: true,
//       message: "Assignment updated successfully",
//       data: assignment,
//     })
//   } catch (error) {
//     console.error("Update assignment error:", error)

//     if (error.name === "ValidationError") {
//       const messages = Object.values(error.errors).map((err) => err.message)
//       return res.status(400).json({
//         success: false,
//         message: "Validation error",
//         errors: messages,
//       })
//     }

//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     })
//   }
// })




router.put("/:id", protect, async (req, res) => {
  try {
    let assignment = await Assignment.findById(req.params.id)

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      })
    }

    // Check permissions
    const canUpdate =
      req.user.role === "admin" ||
      assignment.assignedBy.toString() === req.user.id ||
      assignment.assignee.toString() === req.user.id

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this assignment",
      })
    }

    // Engineers can only update certain fields
    if (req.user.role === "engineer") {
      const allowedFields = ["progress", "status", "actualHours"]
      const updateFields = {}

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateFields[field] = req.body[field]
        }
      })

      assignment = await Assignment.findByIdAndUpdate(
        req.params.id,
        updateFields,
        { new: true, runValidators: true }
      )
        .populate("project", "name description")
        .populate("assignee", "firstName lastName email department")
        .populate("assignedBy", "firstName lastName email")
    } else {
      // Admins and managers can update all fields
      assignment = await Assignment.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      )
        .populate("project", "name description")
        .populate("assignee", "firstName lastName email department")
        .populate("assignedBy", "firstName lastName email")
    }

    // 🔹 NEW CODE: Update project progress dynamically
    if (assignment.project?._id || assignment.project) {
      const projectId = assignment.project._id || assignment.project

      // find all assignments of this project
      const assignments = await Assignment.find({ project: projectId })

      const totalProgress = assignments.reduce(
        (sum, a) => sum + (a.progress || 0),
        0
      )

      const averageProgress =
        assignments.length > 0
          ? Math.round(totalProgress / assignments.length)
          : 0

      // update project progress
      await Project.findByIdAndUpdate(projectId, { progress: averageProgress })
    }

    res.status(200).json({
      success: true,
      message: "Assignment updated successfully",
      data: assignment,
    })
  } catch (error) {
    console.error("Update assignment error:", error)

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message)
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: messages,
      })
    }

    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})


// @desc    Delete assignment
// @route   DELETE /api/assignments/:id
// @access  Private (Admin/Manager)
router.delete("/:id", protect, isAdminOrManager, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      })
    }

    // Check if manager is trying to delete assignment from project they don't manage
    if (req.user.role === "manager") {
      const project = await Project.findById(assignment.project)
      if (project.manager.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You can only delete assignments from projects you manage",
        })
      }
    }

    await Assignment.findByIdAndDelete(req.params.id)

    res.status(200).json({
      success: true,
      message: "Assignment deleted successfully",
    })
  } catch (error) {
    console.error("Delete assignment error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Add comment to assignment
// @route   POST /api/assignments/:id/comments
// @access  Private
router.post("/:id/comments", protect, async (req, res) => {
  try {
    const { text } = req.body

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Comment text is required",
      })
    }

    const assignment = await Assignment.findById(req.params.id)

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      })
    }

    // Check if user has access to this assignment
    if (req.user.role === "engineer" && assignment.assignee.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to comment on this assignment",
      })
    }

    assignment.comments.push({
      user: req.user.id,
      text: text.trim(),
    })

    await assignment.save()

    const updatedAssignment = await Assignment.findById(req.params.id).populate(
      "comments.user",
      "firstName lastName email avatar",
    )

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: updatedAssignment.comments,
    })
  } catch (error) {
    console.error("Add comment error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Add time entry to assignment
// @route   POST /api/assignments/:id/time-entries
// @access  Private (Assignee only)
router.post("/:id/time-entries", protect, async (req, res) => {
  try {
    const { date, hours, description } = req.body

    if (!date || !hours) {
      return res.status(400).json({
        success: false,
        message: "Date and hours are required",
      })
    }

    const assignment = await Assignment.findById(req.params.id)

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      })
    }

    // Only assignee can log time
    if (assignment.assignee.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only the assignee can log time for this assignment",
      })
    }

    assignment.timeEntries.push({
      date: new Date(date),
      hours: Number.parseFloat(hours),
      description: description || "",
    })

    await assignment.save()

    res.status(201).json({
      success: true,
      message: "Time entry added successfully",
      data: assignment.timeEntries,
    })
  } catch (error) {
    console.error("Add time entry error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})






// @desc    Get assignment statistics
// @route   GET /api/assignments/stats
// @access  Private
router.get("/stats/overview", protect, async (req, res) => {
  try {
    const matchQuery = {}

    // Filter based on user role
    if (req.user.role === "engineer") {
      matchQuery.assignee = req.user._id
    } else if (req.user.role === "manager") {
      const managerProjects = await Project.find({ manager: req.user.id }).select("_id")
      const projectIds = managerProjects.map((p) => p._id)
      matchQuery.project = { $in: projectIds }
    }

    const stats = await Assignment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalAssignments: { $sum: 1 },
          activeAssignments: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          completedAssignments: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          totalEstimatedHours: { $sum: "$estimatedHours" },
          totalActualHours: { $sum: "$actualHours" },
          averageProgress: { $avg: "$progress" },
        },
      },
    ])

    const result = stats[0] || {
      totalAssignments: 0,
      activeAssignments: 0,
      completedAssignments: 0,
      totalEstimatedHours: 0,
      totalActualHours: 0,
      averageProgress: 0,
    }

    res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("Get assignment stats error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

module.exports = router
