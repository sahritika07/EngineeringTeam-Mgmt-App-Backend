const express = require("express")
const User = require("../models/User")
const Assignment = require("../models/Assignment")
const Project = require("../models/Project")
const { protect, isAdminOrManager } = require("../middleware/auth")

const router = express.Router()









// @desc    Get all engineers
// @route   GET /api/engineers
// @access  Private (Admin/Manager)
router.get("/", protect, isAdminOrManager, async (req, res) => {
  try {
    const query = { role: "engineer", isActive: true }

    // Filter by department if provided
    if (req.query.department) {
      query.department = req.query.department
    }

    // Filter by experience level if provided
    if (req.query.experienceLevel) {
      query.experienceLevel = req.query.experienceLevel
    }

    // Filter by skills if provided
    if (req.query.skills) {
      const skillsArray = req.query.skills.split(",")
      query.skills = { $in: skillsArray }
    }

    // Search by name
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i")
      query.$or = [{ firstName: searchRegex }, { lastName: searchRegex }, { email: searchRegex }]
    }

    const engineers = await User.find(query)
      .select("-password")
      .populate("currentProjectsCount")
      .sort({ createdAt: -1 })

    // Calculate current workload for each engineer
    const engineersWithWorkload = await Promise.all(
      engineers.map(async (engineer) => {
        const activeAssignments = await Assignment.find({
          assignee: engineer._id,
          status: { $in: ["active", "in-progress"] },
        }).populate("project", "name")

        const totalHours = activeAssignments.reduce((sum, assignment) => sum + (assignment.estimatedHours || 0), 0)

        return {
          ...engineer.toObject(),
          currentProjects: activeAssignments.length,
          currentWorkloadHours: totalHours,
          availableHours: Math.max(0, engineer.availability - totalHours),
          activeAssignments: activeAssignments.map((a) => ({
            id: a._id,
            title: a.title,
            project: a.project.name,
            estimatedHours: a.estimatedHours,
          })),
        }
      }),
    )

    res.status(200).json({
      success: true,
      count: engineersWithWorkload.length,
      data: engineersWithWorkload,
    })
  } catch (error) {
    console.error("Get engineers error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})



// Place this ABOVE router.get("/:id") !!!
router.get("/overview", protect, async (req, res) => {
  try {
    const matchQuery = {}
    let assignmentQuery = {}

    // Filter projects & assignments based on user role
    if (req.user.role === "manager") {
      matchQuery.manager = req.user._id
      assignmentQuery.manager = req.user._id
    } else if (req.user.role === "engineer") {
      const userAssignments = await Assignment.find({ assignee: req.user._id }).distinct("project")
      matchQuery._id = { $in: userAssignments }
      assignmentQuery.assignee = req.user._id
    }

    // ------- Project Stats -------
    const projectStats = await Project.aggregate([
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

    const projectData = projectStats[0] || {
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      totalBudget: 0,
      totalBudgetUsed: 0,
      averageProgress: 0,
    }

    // Add budget utilization %
    projectData.budgetUtilization = projectData.totalBudget
      ? Math.round((projectData.totalBudgetUsed / projectData.totalBudget) * 100)
      : 0

    // ------- Assignment Stats -------
    const assignments = await Assignment.find(assignmentQuery)
    const assignmentData = {
      totalAssignments: assignments.length,
      activeAssignments: assignments.filter((a) =>
        ["active", "in-progress"].includes(a.status)
      ).length,
      completedAssignments: assignments.filter((a) => a.status === "completed").length,
      overdueAssignments: assignments.filter(
        (a) => a.deadline && new Date(a.deadline) < new Date() && a.status !== "completed"
      ).length,
    }

    // ------- Engineers Stats -------
    const engineers = await User.find({ role: "engineer", isActive: true })
    const engineersData = {
      totalEngineers: engineers.length,
      avgUtilization:
        engineers.length > 0
          ? Math.round(
              engineers.reduce((sum, eng) => sum + (eng.utilization || 0), 0) /
                engineers.length
            )
          : 0,
      avgEfficiency:
        engineers.length > 0
          ? Math.round(
              engineers.reduce((sum, eng) => sum + (eng.efficiency || 0), 0) /
                engineers.length
            )
          : 0,
    }

    res.status(200).json({
      success: true,
      data: {
        projects: projectData,
        assignments: assignmentData,
        engineers: engineersData,
      },
    })
  } catch (error) {
    console.error("Stats Overview Error:", error)
    res.status(500).json({ success: false, message: "Server error" })
  }
})



router.put("/post", protect, isAdminOrManager, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      username,
      avatarUrl,
      experienceLevel,
      department,
      hourlyRate,
      availability,
      location,
      skills,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Engineer with this email already exists",
      });
    }

    const newEngineer = await User.create({
      firstName,
      lastName,
      email,
      username,
      avatar: avatarUrl || "/placeholder.svg",
      role: "engineer",
      experienceLevel,
      department,
      hourlyRate,
      availability,
      location,
      skills,
      password: "engineer123", // or generate a random password
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Engineer created successfully",
      data: {
        id: newEngineer._id,
        name: newEngineer.fullName,
        email: newEngineer.email,
      },
    });
  } catch (error) {
    console.error("Create engineer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating engineer",
    });
  }
})


// @desc    Get engineer details with assignments and projects
// @route   GET /api/engineers/:id
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const engineer = await User.findOne({
      _id: req.params.id,
      role: "engineer",
      isActive: true,
    }).select("-password")

    if (!engineer) {
      return res.status(404).json({
        success: false,
        message: "Engineer not found",
      })
    }

    // Check permissions
    if (req.user.role === "engineer" && req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this engineer's details",
      })
    }

    // Get engineer's assignments
    const assignments = await Assignment.find({ assignee: req.params.id })
      .populate("project", "name status priority manager")
      .populate("assignedBy", "firstName lastName")
      .sort({ createdAt: -1 })

    // Get projects the engineer is part of
    const projects = await Project.find({ "teamMembers.user": req.params.id })
      .populate("manager", "firstName lastName")
      .sort({ createdAt: -1 })

    // Calculate statistics
    const stats = {
      totalAssignments: assignments.length,
      activeAssignments: assignments.filter((a) => ["active", "in-progress"].includes(a.status)).length,
      completedAssignments: assignments.filter((a) => a.status === "completed").length,
      totalProjects: projects.length,
      averageProgress:
        assignments.length > 0 ? assignments.reduce((sum, a) => sum + a.progress, 0) / assignments.length : 0,
      totalHoursLogged: assignments.reduce((sum, a) => sum + (a.actualHours || 0), 0),
      totalEstimatedHours: assignments.reduce((sum, a) => sum + (a.estimatedHours || 0), 0),
    }

    res.status(200).json({
      success: true,
      data: {
        engineer,
        assignments,
        projects,
        stats,
      },
    })
  } catch (error) {
    console.error("Get engineer details error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Update engineer utilization and efficiency
// @route   PUT /api/engineers/:id/metrics
// @access  Private (Admin/Manager)
router.put("/:id/metrics", protect, isAdminOrManager, async (req, res) => {
  try {
    const { utilization, efficiency } = req.body

    const engineer = await User.findOne({
      _id: req.params.id,
      role: "engineer",
      isActive: true,
    })

    if (!engineer) {
      return res.status(404).json({
        success: false,
        message: "Engineer not found",
      })
    }

    // Update metrics
    if (utilization !== undefined) {
      engineer.utilization = Math.max(0, Math.min(100, utilization))
    }

    if (efficiency !== undefined) {
      engineer.efficiency = Math.max(0, Math.min(100, efficiency))
    }

    await engineer.save()

    res.status(200).json({
      success: true,
      message: "Engineer metrics updated successfully",
      data: {
        id: engineer._id,
        utilization: engineer.utilization,
        efficiency: engineer.efficiency,
      },
    })
  } catch (error) {
    console.error("Update engineer metrics error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})

// @desc    Get engineer workload analysis
// @route   GET /api/engineers/:id/workload
// @access  Private
router.get("/:id/workload", protect, async (req, res) => {
  try {
    const engineer = await User.findOne({
      _id: req.params.id,
      role: "engineer",
      isActive: true,
    }).select("-password")

    if (!engineer) {
      return res.status(404).json({
        success: false,
        message: "Engineer not found",
      })
    }

    // Check permissions
    if (req.user.role === "engineer" && req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this workload analysis",
      })
    }

    // Get active assignments
    const activeAssignments = await Assignment.find({
      assignee: req.params.id,
      status: { $in: ["active", "in-progress"] },
    }).populate("project", "name priority deadline")

    // Calculate workload
    const totalEstimatedHours = activeAssignments.reduce((sum, a) => sum + (a.estimatedHours || 0), 0)
    const utilizationPercentage = (totalEstimatedHours / engineer.availability) * 100

    // Get upcoming deadlines
    const upcomingDeadlines = activeAssignments
      .filter((a) => a.deadline)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .slice(0, 5)

    // Get overdue assignments
    const overdueAssignments = activeAssignments.filter((a) => a.deadline && new Date(a.deadline) < new Date())

    const workloadAnalysis = {
      engineer: {
        id: engineer._id,
        name: engineer.fullName,
        availability: engineer.availability,
        department: engineer.department,
        experienceLevel: engineer.experienceLevel,
      },
      currentWorkload: {
        activeAssignments: activeAssignments.length,
        totalEstimatedHours,
        availableHours: Math.max(0, engineer.availability - totalEstimatedHours),
        utilizationPercentage: Math.round(utilizationPercentage),
        isOverloaded: utilizationPercentage > 100,
      },
      assignments: activeAssignments.map((a) => ({
        id: a._id,
        title: a.title,
        project: a.project.name,
        priority: a.priority,
        estimatedHours: a.estimatedHours,
        progress: a.progress,
        deadline: a.deadline,
        daysUntilDeadline: a.daysUntilDeadline,
      })),
      upcomingDeadlines,
      overdueAssignments,
      recommendations: [],
    }

    // Add recommendations based on workload
    if (utilizationPercentage > 100) {
      workloadAnalysis.recommendations.push({
        type: "warning",
        message: "Engineer is overloaded. Consider redistributing assignments.",
      })
    } else if (utilizationPercentage < 50) {
      workloadAnalysis.recommendations.push({
        type: "info",
        message: "Engineer has capacity for additional assignments.",
      })
    }

    if (overdueAssignments.length > 0) {
      workloadAnalysis.recommendations.push({
        type: "urgent",
        message: `${overdueAssignments.length} assignment(s) are overdue.`,
      })
    }

    res.status(200).json({
      success: true,
      data: workloadAnalysis,
    })
  } catch (error) {
    console.error("Get engineer workload error:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
    })
  }
})



router.post("/post", protect, isAdminOrManager, async (req, res) => {
  console.log("converted to post")
  try {
    const {
      firstName,
      lastName,
      email,
      username,
      avatarUrl,
      experienceLevel,
      department,
      hourlyRate,
      availability,
      location,
      skills,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Engineer with this email already exists",
      });
    }

    const newEngineer = await User.create({
      firstName,
      lastName,
      email,
      username,
      avatar: avatarUrl || "/placeholder.svg",
      role: "engineer",
      experienceLevel,
      department,
      hourlyRate,
      availability,
      location,
      skills,
      password: "engineer123", // or generate a random password
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Engineer created successfully",
      data: {
        id: newEngineer._id,
        name: newEngineer.fullName,
        email: newEngineer.email,
      },
    });
  } catch (error) {
    console.error("Create engineer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating engineer",
    });
  }
});




module.exports = router
