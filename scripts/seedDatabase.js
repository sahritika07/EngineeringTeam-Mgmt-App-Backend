const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const dotenv = require("dotenv")
const User = require("../models/User")
const Project = require("../models/Project")
const Assignment = require("../models/Assignment")

// Load environment variables
dotenv.config()

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/engineering-resource-management")
    console.log("MongoDB connected for seeding")
  } catch (error) {
    console.error("Database connection error:", error)
    process.exit(1)
  }
}

const seedUsers = async () => {
  try {
    // Clear existing users
    await User.deleteMany({})

    const users = [
      // Admin Users
      {
        firstName: "Admin",
        lastName: "User",
        email: "admin@company.com",
        password: "admin123",
        role: "admin",
        department: "Full Stack",
        experienceLevel: "principal",
        skills: ["React", "Node.js", "MongoDB", "AWS"],
        availability: 40,
        location: "San Francisco, CA",
        utilization: 85,
        efficiency: 95,
      },
      // Manager Users
      {
        firstName: "Sarah",
        lastName: "Chen",
        email: "sarah.chen@company.com",
        password: "manager123",
        role: "manager",
        department: "Frontend",
        experienceLevel: "lead",
        skills: ["React", "Vue.js", "TypeScript", "Project Management"],
        availability: 40,
        location: "Seattle, WA",
        utilization: 90,
        efficiency: 92,
      },
      {
        firstName: "Michael",
        lastName: "Johnson",
        email: "michael.johnson@company.com",
        password: "manager123",
        role: "manager",
        department: "Backend",
        experienceLevel: "senior",
        skills: ["Node.js", "Python", "Docker", "Kubernetes"],
        availability: 40,
        location: "Austin, TX",
        utilization: 88,
        efficiency: 90,
      },
      // Engineer Users
      {
        firstName: "Alex",
        lastName: "Rodriguez",
        email: "alex.rodriguez@company.com",
        password: "engineer123",
        role: "engineer",
        department: "Frontend",
        experienceLevel: "senior",
        skills: ["React", "Node.js", "TypeScript", "GraphQL"],
        hourlyRate: 85,
        availability: 40,
        location: "San Francisco, CA",
        utilization: 95,
        efficiency: 98,
      },
      {
        firstName: "Maria",
        lastName: "Kim",
        email: "maria.kim@company.com",
        password: "engineer123",
        role: "engineer",
        department: "DevOps",
        experienceLevel: "lead",
        skills: ["Docker", "Kubernetes", "AWS", "Terraform"],
        hourlyRate: 90,
        availability: 40,
        location: "Seattle, WA",
        utilization: 88,
        efficiency: 96,
      },
      {
        firstName: "James",
        lastName: "Wilson",
        email: "james.wilson@company.com",
        password: "engineer123",
        role: "engineer",
        department: "AI/ML",
        experienceLevel: "principal",
        skills: ["Python", "TensorFlow", "PyTorch", "Machine Learning"],
        hourlyRate: 95,
        availability: 40,
        location: "New York, NY",
        utilization: 92,
        efficiency: 94,
      },
      {
        firstName: "Emily",
        lastName: "Davis",
        email: "emily.davis@company.com",
        password: "engineer123",
        role: "engineer",
        department: "Backend",
        experienceLevel: "mid",
        skills: ["Node.js", "Express.js", "MongoDB", "PostgreSQL"],
        hourlyRate: 70,
        availability: 40,
        location: "Chicago, IL",
        utilization: 85,
        efficiency: 88,
      },
      {
        firstName: "David",
        lastName: "Brown",
        email: "david.brown@company.com",
        password: "engineer123",
        role: "engineer",
        department: "Mobile",
        experienceLevel: "senior",
        skills: ["React Native", "Flutter", "iOS", "Android"],
        hourlyRate: 80,
        availability: 40,
        location: "Los Angeles, CA",
        utilization: 90,
        efficiency: 91,
      },
      {
        firstName: "Lisa",
        lastName: "Anderson",
        email: "lisa.anderson@company.com",
        password: "engineer123",
        role: "engineer",
        department: "QA",
        experienceLevel: "mid",
        skills: ["Selenium", "Jest", "Cypress", "Test Automation"],
        hourlyRate: 65,
        availability: 40,
        location: "Denver, CO",
        utilization: 80,
        efficiency: 85,
      },
    ]

    const createdUsers = await User.create(users)
    console.log(`${createdUsers.length} users created successfully`)
    return createdUsers
  } catch (error) {
    console.error("Error seeding users:", error)
    throw error
  }
}

const seedProjects = async (users) => {
  try {
    // Clear existing projects
    await Project.deleteMany({})

    const managers = users.filter((user) => user.role === "manager")
    const engineers = users.filter((user) => user.role === "engineer")

    const projects = [
      {
        name: "E-commerce Platform v2.0",
        description: "Next-generation e-commerce platform with AI recommendations and advanced analytics",
        status: "active",
        priority: "high",
        progress: 75,
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        budget: 500000,
        budgetUsed: 375000,
        manager: managers[0]._id,
        teamMembers: [
          { user: engineers[0]._id, role: "Lead Frontend Developer", hoursPerWeek: 40 },
          { user: engineers[3]._id, role: "Backend Developer", hoursPerWeek: 35 },
          { user: engineers[5]._id, role: "QA Engineer", hoursPerWeek: 30 },
        ],
        technologies: ["React", "Node.js", "MongoDB", "AWS", "Docker"],
        milestones: [
          {
            name: "Frontend Development",
            description: "Complete frontend implementation",
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: "completed",
            completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          },
          {
            name: "Backend API",
            description: "Implement all backend APIs",
            dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
            status: "in-progress",
          },
        ],
      },
      {
        name: "Mobile App Redesign",
        description: "Complete redesign of mobile application with new UX and performance improvements",
        status: "active",
        priority: "medium",
        progress: 60,
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
        budget: 200000,
        budgetUsed: 120000,
        manager: managers[0]._id,
        teamMembers: [
          { user: engineers[4]._id, role: "Mobile Developer", hoursPerWeek: 40 },
          { user: engineers[0]._id, role: "UI/UX Consultant", hoursPerWeek: 10 },
        ],
        technologies: ["React Native", "Firebase", "Redux"],
        milestones: [
          {
            name: "Design System",
            description: "Create new design system",
            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            status: "completed",
            completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      {
        name: "AI Analytics Dashboard",
        description: "Machine learning powered analytics dashboard for business intelligence",
        status: "planning",
        priority: "high",
        progress: 25,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        budget: 300000,
        budgetUsed: 75000,
        manager: managers[1]._id,
        teamMembers: [
          { user: engineers[2]._id, role: "ML Engineer", hoursPerWeek: 40 },
          { user: engineers[3]._id, role: "Backend Developer", hoursPerWeek: 20 },
        ],
        technologies: ["Python", "TensorFlow", "React", "PostgreSQL"],
        milestones: [
          {
            name: "Data Pipeline",
            description: "Set up data processing pipeline",
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: "in-progress",
          },
        ],
      },
      {
        name: "DevOps Infrastructure Upgrade",
        description: "Modernize deployment pipeline and infrastructure with Kubernetes",
        status: "active",
        priority: "medium",
        progress: 40,
        deadline: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000), // 75 days from now
        budget: 150000,
        budgetUsed: 60000,
        manager: managers[1]._id,
        teamMembers: [{ user: engineers[1]._id, role: "DevOps Lead", hoursPerWeek: 40 }],
        technologies: ["Kubernetes", "Docker", "AWS", "Terraform"],
      },
    ]

    const createdProjects = await Project.create(projects)
    console.log(`${createdProjects.length} projects created successfully`)
    return createdProjects
  } catch (error) {
    console.error("Error seeding projects:", error)
    throw error
  }
}

const seedAssignments = async (users, projects) => {
  try {
    // Clear existing assignments
    await Assignment.deleteMany({})

    const managers = users.filter((user) => user.role === "manager")
    const engineers = users.filter((user) => user.role === "engineer")

    const assignments = [
      {
        title: "Implement Product Catalog API",
        description: "Create RESTful API for product catalog with search and filtering capabilities",
        project: projects[0]._id,
        assignee: engineers[3]._id,
        assignedBy: managers[0]._id,
        status: "active",
        priority: "high",
        progress: 80,
        estimatedHours: 40,
        actualHours: 35,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        tags: ["backend", "api", "database"],
        timeEntries: [
          {
            date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            hours: 8,
            description: "Set up database schema and models",
          },
          {
            date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
            hours: 7,
            description: "Implemented CRUD operations",
          },
          {
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            hours: 8,
            description: "Added search and filtering logic",
          },
          {
            date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
            hours: 6,
            description: "API testing and optimization",
          },
          {
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            hours: 6,
            description: "Documentation and code review",
          },
        ],
      },
      {
        title: "Frontend Component Library",
        description: "Build reusable React component library for consistent UI across the platform",
        project: projects[0]._id,
        assignee: engineers[0]._id,
        assignedBy: managers[0]._id,
        status: "completed",
        priority: "medium",
        progress: 100,
        estimatedHours: 60,
        actualHours: 58,
        deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        tags: ["frontend", "react", "components"],
        timeEntries: [
          {
            date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            hours: 8,
            description: "Component architecture planning",
          },
          {
            date: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
            hours: 8,
            description: "Button and form components",
          },
          {
            date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
            hours: 8,
            description: "Layout and navigation components",
          },
          {
            date: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
            hours: 7,
            description: "Data display components",
          },
          {
            date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            hours: 8,
            description: "Component testing",
          },
          {
            date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
            hours: 8,
            description: "Storybook setup and documentation",
          },
          {
            date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            hours: 7,
            description: "Final testing and deployment",
          },
          {
            date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            hours: 4,
            description: "Code review and fixes",
          },
        ],
      },
      {
        title: "Mobile App Navigation Redesign",
        description: "Redesign mobile app navigation for better user experience",
        project: projects[1]._id,
        assignee: engineers[4]._id,
        assignedBy: managers[0]._id,
        status: "in-progress",
        priority: "high",
        progress: 65,
        estimatedHours: 35,
        actualHours: 22,
        deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        tags: ["mobile", "ui", "navigation"],
        timeEntries: [
          {
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            hours: 8,
            description: "Navigation architecture design",
          },
          {
            date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
            hours: 7,
            description: "Implementation of new navigation components",
          },
          {
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            hours: 7,
            description: "Integration with existing screens",
          },
        ],
      },
      {
        title: "ML Model Training Pipeline",
        description: "Set up automated pipeline for training and deploying ML models",
        project: projects[2]._id,
        assignee: engineers[2]._id,
        assignedBy: managers[1]._id,
        status: "active",
        priority: "high",
        progress: 30,
        estimatedHours: 50,
        actualHours: 15,
        deadline: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
        tags: ["ml", "pipeline", "automation"],
        timeEntries: [
          {
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            hours: 8,
            description: "Pipeline architecture design",
          },
          {
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            hours: 7,
            description: "Data preprocessing setup",
          },
        ],
      },
      {
        title: "Kubernetes Cluster Setup",
        description: "Set up production-ready Kubernetes cluster with monitoring",
        project: projects[3]._id,
        assignee: engineers[1]._id,
        assignedBy: managers[1]._id,
        status: "active",
        priority: "medium",
        progress: 45,
        estimatedHours: 45,
        actualHours: 20,
        deadline: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
        tags: ["devops", "kubernetes", "infrastructure"],
        timeEntries: [
          {
            date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
            hours: 8,
            description: "Cluster architecture planning",
          },
          {
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            hours: 6,
            description: "Master node setup",
          },
          {
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            hours: 6,
            description: "Worker nodes configuration",
          },
        ],
      },
      {
        title: "E2E Testing Suite",
        description: "Implement comprehensive end-to-end testing for the e-commerce platform",
        project: projects[0]._id,
        assignee: engineers[5]._id,
        assignedBy: managers[0]._id,
        status: "active",
        priority: "medium",
        progress: 55,
        estimatedHours: 30,
        actualHours: 16,
        deadline: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
        tags: ["testing", "e2e", "automation"],
        timeEntries: [
          {
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            hours: 8,
            description: "Test framework setup",
          },
          {
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            hours: 8,
            description: "User journey test cases",
          },
        ],
      },
    ]

    const createdAssignments = await Assignment.create(assignments)
    console.log(`${createdAssignments.length} assignments created successfully`)
    return createdAssignments
  } catch (error) {
    console.error("Error seeding assignments:", error)
    throw error
  }
}

const seedDatabase = async () => {
  try {
    await connectDB()

    console.log("Starting database seeding...")

    const users = await seedUsers()
    const projects = await seedProjects(users)
    const assignments = await seedAssignments(users, projects)

    console.log("Database seeding completed successfully!")
    console.log(`Created:`)
    console.log(`- ${users.length} users`)
    console.log(`- ${projects.length} projects`)
    console.log(`- ${assignments.length} assignments`)

    console.log("\nDefault login credentials:")
    console.log("Admin: admin@company.com / admin123")
    console.log("Manager: sarah.chen@company.com / manager123")
    console.log("Engineer: alex.rodriguez@company.com / engineer123")

    process.exit(0)
  } catch (error) {
    console.error("Database seeding failed:", error)
    process.exit(1)
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
}

module.exports = { seedDatabase }
