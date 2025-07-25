const express = require("express")
const User = require("../models/User")
const Assignment = require("../models/Assignment")
const Project = require("../models/Project")
const { protect, authorize, isAdmin, isAdminOrManager } = require("../middleware/auth")

const router = express.Router()

// @desc    Get all users/engineers
// @route   GET /api/users
// @access  Private (Admin/Manager)
router.get("/", protect, isAdminOrManager, async (req, res) => {
  try {
    const query = { isActive: true }

    // Filter by role if provided
    if (req.query.role) {
      query.role = req.query.role
    }

    // Filter by department if provided
    if (req.query.department) {
      query.department = req.query.department
    }

    // Filter by experience level if provided
    if (req.query.experienceLevel) {
      query.experienceLevel = req.query.experienceLevel
    }

    // Search by name or email
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i")
      query.$or = [{ firstName: searchRegex }, { lastName: searchRegex }, { email: searchRegex }]
    }

    const users = await User.find(query).select("-password").populate("currentProjectsCount").sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    })
  } catch (error) {
    console.error("Get users error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password").populate("currentProjectsCount")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Engineers can only view their own profile
    if (req.user.role === "engineer" && req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this profile",
      })
    }

    // Get user's assignments and projects
    const assignments = await Assignment.find({ assignee: req.params.id })
      .populate("project", "name status priority")
      .sort({ createdAt: -1 })
      .limit(10)

    const projects = await Project.find({ "teamMembers.user": req.params.id })
      .populate("manager", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(10)

    res.status(200).json({
      success: true,
      data: {
        user,
        assignments,
        projects,
      },
    })
  } catch (error) {
    console.error("Get user error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Create new user
// @route   POST /api/users
// @access  Private (Admin)
router.post("/", protect, isAdmin, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      department,
      experienceLevel,
      skills,
      hourlyRate,
      availability,
      location,
      phone,
    } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      })
    }

    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      role: role || "engineer",
      department,
      experienceLevel: experienceLevel || "junior",
      skills: skills || [],
      hourlyRate,
      availability: availability || 40,
      location,
      phone,
    })

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        department: user.department,
        experienceLevel: user.experienceLevel,
      },
    })
  } catch (error) {
    console.error("Create user error:", error)

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

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private
router.put("/:id", protect, async (req, res) => {
  try {
    let user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Check permissions
    const canUpdate = req.user.role === "admin" || req.user.id === req.params.id

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this user",
      })
    }

    // Engineers can only update certain fields
    if (req.user.role === "engineer" && req.user.id === req.params.id) {
      const allowedFields = ["firstName", "lastName", "phone", "location", "skills", "availability"]
      const updateFields = {}

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateFields[field] = req.body[field]
        }
      })

      user = await User.findByIdAndUpdate(req.params.id, updateFields, { new: true, runValidators: true }).select(
        "-password",
      )
    } else {
      // Admins can update all fields except password
      const { password, ...updateFields } = req.body
      user = await User.findByIdAndUpdate(req.params.id, updateFields, { new: true, runValidators: true }).select(
        "-password",
      )
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    })
  } catch (error) {
    console.error("Update user error:", error)

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

// @desc    Delete/Deactivate user
// @route   DELETE /api/users/:id
// @access  Private (Admin)
router.delete("/:id", protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Don't allow deleting the last admin
    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin", isActive: true })
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete the last admin user",
        })
      }
    }

    // Soft delete - deactivate user instead of removing
    user.isActive = false
    await user.save()

    // Reassign or cancel active assignments
    await Assignment.updateMany(
      { assignee: req.params.id, status: { $in: ["active", "in-progress"] } },
      { status: "cancelled" },
    )

    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
    })
  } catch (error) {
    console.error("Delete user error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Get user statistics
// @route   GET /api/users/stats/overview
// @access  Private (Admin/Manager)
router.get("/stats/overview", protect, isAdminOrManager, async (req, res) => {
  try {
    const stats = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalEngineers: {
            $sum: { $cond: [{ $eq: ["$role", "engineer"] }, 1, 0] },
          },
          totalManagers: {
            $sum: { $cond: [{ $eq: ["$role", "manager"] }, 1, 0] },
          },
          totalAdmins: {
            $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] },
          },
          averageUtilization: { $avg: "$utilization" },
          averageEfficiency: { $avg: "$efficiency" },
        },
      },
    ])

    // Get department breakdown
    const departmentStats = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$department",
          count: { $sum: 1 },
          averageUtilization: { $avg: "$utilization" },
        },
      },
      { $sort: { count: -1 } },
    ])

    // Get experience level breakdown
    const experienceStats = await User.aggregate([
      { $match: { isActive: true, role: "engineer" } },
      {
        $group: {
          _id: "$experienceLevel",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])

    const result = stats[0] || {
      totalUsers: 0,
      totalEngineers: 0,
      totalManagers: 0,
      totalAdmins: 0,
      averageUtilization: 0,
      averageEfficiency: 0,
    }

    res.status(200).json({
      success: true,
      data: {
        overview: result,
        departmentBreakdown: departmentStats,
        experienceBreakdown: experienceStats,
      },
    })
  } catch (error) {
    console.error("Get user stats error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Get available engineers for assignment
// @route   GET /api/users/available-engineers
// @access  Private (Admin/Manager)
router.get("/available-engineers", protect, isAdminOrManager, async (req, res) => {
  try {
    const { skills, department, experienceLevel, maxHours } = req.query

    const query = {
      role: "engineer",
      isActive: true,
    }

    if (department) {
      query.department = department
    }

    if (experienceLevel) {
      query.experienceLevel = experienceLevel
    }

    if (skills) {
      const skillsArray = skills.split(",")
      query.skills = { $in: skillsArray }
    }

    let engineers = await User.find(query).select("-password").populate("currentProjectsCount")

    // Filter by availability if maxHours is specified
    if (maxHours) {
      engineers = engineers.filter((engineer) => {
        const currentWorkload = engineer.currentProjectsCount || 0
        const availableHours = engineer.availability - currentWorkload
        return availableHours >= Number.parseInt(maxHours)
      })
    }

    res.status(200).json({
      success: true,
      count: engineers.length,
      data: engineers,
    })
  } catch (error) {
    console.error("Get available engineers error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

module.exports = router
