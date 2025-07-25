const express = require("express")
const Project = require("../models/Project")
const Assignment = require("../models/Assignment")
const { protect, authorize, isAdminOrManager } = require("../middleware/auth")

const router = express.Router()

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const query = {}

    // If user is manager, only show their projects
    if (req.user.role === "manager") {
      query.manager = req.user.id
    }

    // If user is engineer, show projects they're assigned to
    if (req.user.role === "engineer") {
      const userAssignments = await Assignment.find({ assignee: req.user.id }).distinct("project")
      query._id = { $in: userAssignments }
    }
    

    // Filter by status if provided
    if (req.query.status) {
      query.status = req.query.status
    }

    const projects = await Project.find(query)
      .populate("manager", "firstName lastName email")
      .populate("teamMembers.user", "firstName lastName email department experienceLevel")
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects,
    })
  } catch (error) {
    console.error("Get projects error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("manager", "firstName lastName email department")
      .populate("teamMembers.user", "firstName lastName email department experienceLevel skills")
      .populate("assignments")

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      })
    }

    // Check if user has access to this project
    if (req.user.role === "manager" && project.manager._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this project",
      })
    }

    if (req.user.role === "engineer") {
      const isTeamMember = project.teamMembers.some((member) => member.user._id.toString() === req.user.id)
      if (!isTeamMember) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to access this project",
        })
      }
    }

    res.status(200).json({
      success: true,
      data: project,
    })
  } catch (error) {
    console.error("Get project error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Create new project
// @route   POST /api/projects
// @access  Private (Admin/Manager)
router.post("/", protect, isAdminOrManager, async (req, res) => {
  try {
    const { name, description, priority, deadline, budget, technologies, teamMembers } = req.body
    console.log( name, description, priority, deadline, budget, technologies, teamMembers)
    // Set manager to current user if not admin
    const manager = req.user.role === "admin" ? req.body.manager || req.user.id : req.user.id

    const project = await Project.create({
      name,
      description,
      priority: priority || "medium",
      deadline,
      budget,
      manager,
      technologies: technologies || [],
      teamMembers: teamMembers || [],
    })

    const populatedProject = await Project.findById(project._id)
      .populate("manager", "firstName lastName email")
      .populate("teamMembers.user", "firstName lastName email department")

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: populatedProject,
    })
  } catch (error) {
    console.error("Create project error:", error)

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

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private (Admin/Manager)
router.put("/:id", protect, isAdminOrManager, async (req, res) => {
  try {
    let project = await Project.findById(req.params.id)

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      })
    }

    // Check if manager is trying to update project they don't manage
    if (req.user.role === "manager" && project.manager.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only update projects you manage",
      })
    }

    project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate("manager", "firstName lastName email")
      .populate("teamMembers.user", "firstName lastName email department")

    res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: project,
    })
  } catch (error) {
    console.error("Update project error:", error)

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

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private (Admin/Manager)
router.delete("/:id", protect, isAdminOrManager, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      })
    }

    // Check if manager is trying to delete project they don't manage
    if (req.user.role === "manager" && project.manager.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only delete projects you manage",
      })
    }

    // Delete all assignments related to this project
    await Assignment.deleteMany({ project: req.params.id })

    await Project.findByIdAndDelete(req.params.id)

    res.status(200).json({
      success: true,
      message: "Project and related assignments deleted successfully",
    })
  } catch (error) {
    console.error("Delete project error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Add team member to project
// @route   POST /api/projects/:id/team-members
// @access  Private (Admin/Manager)
router.post("/:id/team-members", protect, isAdminOrManager, async (req, res) => {
  try {
    const { userId, role, hoursPerWeek } = req.body

    const project = await Project.findById(req.params.id)

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      })
    }

    // Check if manager is trying to modify project they don't manage
    if (req.user.role === "manager" && project.manager.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only modify projects you manage",
      })
    }

    // Check if user is already a team member
    const existingMember = project.teamMembers.find((member) => member.user.toString() === userId)

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: "User is already a team member",
      })
    }

    project.teamMembers.push({
      user: userId,
      role,
      hoursPerWeek: hoursPerWeek || 40,
    })

    await project.save()

    const updatedProject = await Project.findById(req.params.id).populate(
      "teamMembers.user",
      "firstName lastName email department",
    )

    res.status(200).json({
      success: true,
      message: "Team member added successfully",
      data: updatedProject.teamMembers,
    })
  } catch (error) {
    console.error("Add team member error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Remove team member from project
// @route   DELETE /api/projects/:id/team-members/:userId
// @access  Private (Admin/Manager)
router.delete("/:id/team-members/:userId", protect, isAdminOrManager, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      })
    }

    // Check if manager is trying to modify project they don't manage
    if (req.user.role === "manager" && project.manager.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only modify projects you manage",
      })
    }

    project.teamMembers = project.teamMembers.filter((member) => member.user.toString() !== req.params.userId)

    await project.save()

    res.status(200).json({
      success: true,
      message: "Team member removed successfully",
      data: project.teamMembers,
    })
  } catch (error) {
    console.error("Remove team member error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Get project statistics
// @route   GET /api/projects/stats/overview
// @access  Private
router.get("/stats/overview", protect, async (req, res) => {
  try {
    const matchQuery = {}

    // Filter based on user role
    if (req.user.role === "manager") {
      matchQuery.manager = req.user._id
    } else if (req.user.role === "engineer") {
      const userAssignments = await Assignment.find({ assignee: req.user.id }).distinct("project")
      matchQuery._id = { $in: userAssignments }
    }

    const stats = await Project.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          activeProjects: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          completedProjects: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          totalBudget: { $sum: "$budget" },
          totalBudgetUsed: { $sum: "$budgetUsed" },
          averageProgress: { $avg: "$progress" },
        },
      },
    ])

    const result = stats[0] || {
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      totalBudget: 0,
      totalBudgetUsed: 0,
      averageProgress: 0,
    }

    res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("Get project stats error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

module.exports = router
