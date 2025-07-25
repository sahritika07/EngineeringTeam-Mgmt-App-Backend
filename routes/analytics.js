const express = require("express")
const User = require("../models/User")
const Project = require("../models/Project")
const Assignment = require("../models/Assignment")
const { protect, isAdminOrManager } = require("../middleware/auth")

const router = express.Router()

// @desc    Get dashboard analytics
// @route   GET /api/analytics/dashboard
// @access  Private
router.get("/dashboard", protect, async (req, res) => {
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

    // Get basic counts
    const [userStats, projectStats, assignmentStats] = await Promise.all([
      User.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            totalEngineers: { $sum: { $cond: [{ $eq: ["$role", "engineer"] }, 1, 0] } },
            averageUtilization: { $avg: "$utilization" },
            averageEfficiency: { $avg: "$efficiency" },
          },
        },
      ]),
      Project.aggregate([
        {
          $group: {
            _id: null,
            totalProjects: { $sum: 1 },
            activeProjects: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
            completedProjects: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            totalBudget: { $sum: "$budget" },
            averageProgress: { $avg: "$progress" },
          },
        },
      ]),
      Assignment.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalAssignments: { $sum: 1 },
            activeAssignments: { $sum: { $cond: [{ $in: ["$status", ["active", "in-progress"]] }, 1, 0] } },
            completedAssignments: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            totalEstimatedHours: { $sum: "$estimatedHours" },
            totalActualHours: { $sum: "$actualHours" },
            averageProgress: { $avg: "$progress" },
          },
        },
      ]),
    ])

    // Get project status distribution
    const projectStatusDistribution = await Project.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ])

    // Get assignment priority distribution
    const assignmentPriorityDistribution = await Assignment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ])

    // Get department utilization
    const departmentUtilization = await User.aggregate([
      { $match: { role: "engineer", isActive: true } },
      {
        $group: {
          _id: "$department",
          averageUtilization: { $avg: "$utilization" },
          count: { $sum: 1 },
        },
      },
      { $sort: { averageUtilization: -1 } },
    ])

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentActivity = await Assignment.aggregate([
      { $match: { ...matchQuery, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    const result = {
      overview: {
        users: userStats[0] || { totalUsers: 0, totalEngineers: 0, averageUtilization: 0, averageEfficiency: 0 },
        projects: projectStats[0] || {
          totalProjects: 0,
          activeProjects: 0,
          completedProjects: 0,
          totalBudget: 0,
          averageProgress: 0,
        },
        assignments: assignmentStats[0] || {
          totalAssignments: 0,
          activeAssignments: 0,
          completedAssignments: 0,
          totalEstimatedHours: 0,
          totalActualHours: 0,
          averageProgress: 0,
        },
      },
      distributions: {
        projectStatus: projectStatusDistribution,
        assignmentPriority: assignmentPriorityDistribution,
        departmentUtilization,
      },
      trends: {
        recentActivity,
      },
    }

    res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("Get dashboard analytics error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Get resource utilization analytics
// @route   GET /api/analytics/utilization
// @access  Private (Admin/Manager)
router.get("/utilization", protect, isAdminOrManager, async (req, res) => {
  try {
    // Get utilization by department
    const departmentUtilization = await User.aggregate([
      { $match: { role: "engineer", isActive: true } },
      {
        $group: {
          _id: "$department",
          averageUtilization: { $avg: "$utilization" },
          averageEfficiency: { $avg: "$efficiency" },
          totalEngineers: { $sum: 1 },
          totalAvailableHours: { $sum: "$availability" },
        },
      },
      { $sort: { averageUtilization: -1 } },
    ])

    // Get utilization by experience level
    const experienceUtilization = await User.aggregate([
      { $match: { role: "engineer", isActive: true } },
      {
        $group: {
          _id: "$experienceLevel",
          averageUtilization: { $avg: "$utilization" },
          averageEfficiency: { $avg: "$efficiency" },
          count: { $sum: 1 },
        },
      },
      { $sort: { averageUtilization: -1 } },
    ])

    // Get top performers
    const topPerformers = await User.find({
      role: "engineer",
      isActive: true,
    })
      .select("firstName lastName department experienceLevel utilization efficiency")
      .sort({ efficiency: -1, utilization: -1 })
      .limit(10)

    // Get underutilized resources
    const underutilized = await User.find({
      role: "engineer",
      isActive: true,
      utilization: { $lt: 70 },
    })
      .select("firstName lastName department experienceLevel utilization efficiency availability")
      .sort({ utilization: 1 })
      .limit(10)

    // Get overutilized resources
    const overutilized = await User.find({
      role: "engineer",
      isActive: true,
      utilization: { $gt: 100 },
    })
      .select("firstName lastName department experienceLevel utilization efficiency availability")
      .sort({ utilization: -1 })
      .limit(10)

    res.status(200).json({
      success: true,
      data: {
        departmentUtilization,
        experienceUtilization,
        topPerformers,
        underutilized,
        overutilized,
      },
    })
  } catch (error) {
    console.error("Get utilization analytics error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Get project performance analytics
// @route   GET /api/analytics/projects
// @access  Private (Admin/Manager)
router.get("/projects", protect, isAdminOrManager, async (req, res) => {
  try {
    const matchQuery = {}

    // If manager, only show their projects
    if (req.user.role === "manager") {
      matchQuery.manager = req.user._id
    }

    // Get project performance metrics
    const projectMetrics = await Project.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          averageProgress: { $avg: "$progress" },
          totalBudget: { $sum: "$budget" },
          totalBudgetUsed: { $sum: "$budgetUsed" },
          onTimeProjects: {
            $sum: {
              $cond: [{ $and: [{ $eq: ["$status", "completed"] }, { $lte: ["$updatedAt", "$deadline"] }] }, 1, 0],
            },
          },
          overdueProjects: {
            $sum: {
              $cond: [{ $and: [{ $ne: ["$status", "completed"] }, { $lt: ["$deadline", new Date()] }] }, 1, 0],
            },
          },
        },
      },
    ])

    // Get projects by status
    const projectsByStatus = await Project.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          averageProgress: { $avg: "$progress" },
          totalBudget: { $sum: "$budget" },
        },
      },
    ])

    // Get projects by priority
    const projectsByPriority = await Project.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
          averageProgress: { $avg: "$progress" },
        },
      },
    ])

    // Get top performing projects
    const topProjects = await Project.find(matchQuery)
      .select("name status priority progress budget budgetUsed deadline manager")
      .populate("manager", "firstName lastName")
      .sort({ progress: -1, budgetUsed: 1 })
      .limit(10)

    // Get projects at risk
    const projectsAtRisk = await Project.find({
      ...matchQuery,
      $or: [
        { deadline: { $lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, status: { $ne: "completed" } }, // Due in 7 days
        { progress: { $lt: 50 }, deadline: { $lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }, // Low progress with deadline in 30 days
      ],
    })
      .select("name status priority progress deadline manager")
      .populate("manager", "firstName lastName")
      .sort({ deadline: 1 })

    res.status(200).json({
      success: true,
      data: {
        metrics: projectMetrics[0] || {
          totalProjects: 0,
          averageProgress: 0,
          totalBudget: 0,
          totalBudgetUsed: 0,
          onTimeProjects: 0,
          overdueProjects: 0,
        },
        distributions: {
          byStatus: projectsByStatus,
          byPriority: projectsByPriority,
        },
        topProjects,
        projectsAtRisk,
      },
    })
  } catch (error) {
    console.error("Get project analytics error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Get time tracking analytics
// @route   GET /api/analytics/time-tracking
// @access  Private
router.get("/time-tracking", protect, async (req, res) => {
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

    // Get time tracking metrics
    const timeMetrics = await Assignment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalEstimatedHours: { $sum: "$estimatedHours" },
          totalActualHours: { $sum: "$actualHours" },
          totalAssignments: { $sum: 1 },
          averageEstimatedHours: { $avg: "$estimatedHours" },
          averageActualHours: { $avg: "$actualHours" },
        },
      },
    ])

    // Get time accuracy by engineer
    const timeAccuracyByEngineer = await Assignment.aggregate([
      { $match: { ...matchQuery, actualHours: { $gt: 0 }, estimatedHours: { $gt: 0 } } },
      {
        $lookup: {
          from: "users",
          localField: "assignee",
          foreignField: "_id",
          as: "engineer",
        },
      },
      { $unwind: "$engineer" },
      {
        $group: {
          _id: "$assignee",
          engineerName: { $first: { $concat: ["$engineer.firstName", " ", "$engineer.lastName"] } },
          department: { $first: "$engineer.department" },
          totalEstimated: { $sum: "$estimatedHours" },
          totalActual: { $sum: "$actualHours" },
          assignmentCount: { $sum: 1 },
        },
      },
      {
        $addFields: {
          accuracy: {
            $multiply: [
              {
                $divide: [{ $min: ["$totalEstimated", "$totalActual"] }, { $max: ["$totalEstimated", "$totalActual"] }],
              },
              100,
            ],
          },
        },
      },
      { $sort: { accuracy: -1 } },
    ])

    // Get monthly time trends
    const monthlyTrends = await Assignment.aggregate([
      { $match: matchQuery },
      { $unwind: "$timeEntries" },
      {
        $group: {
          _id: {
            year: { $year: "$timeEntries.date" },
            month: { $month: "$timeEntries.date" },
          },
          totalHours: { $sum: "$timeEntries.hours" },
          entryCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ])

    res.status(200).json({
      success: true,
      data: {
        metrics: timeMetrics[0] || {
          totalEstimatedHours: 0,
          totalActualHours: 0,
          totalAssignments: 0,
          averageEstimatedHours: 0,
          averageActualHours: 0,
        },
        timeAccuracyByEngineer,
        monthlyTrends,
      },
    })
  } catch (error) {
    console.error("Get time tracking analytics error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

module.exports = router
