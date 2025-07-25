# Engineering Resource Management System - Backend

A comprehensive backend API for managing engineering resources, projects, and assignments built with Node.js, Express.js, and MongoDB.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **User Management**: Admin, Manager, and Engineer roles with different permissions
- **Project Management**: Create, update, and track engineering projects
- **Assignment Management**: Assign tasks to engineers with time tracking
- **Analytics**: Comprehensive analytics and reporting
- **Security**: Multiple security layers including rate limiting, data sanitization, and CORS
- **Database**: MongoDB with Mongoose ODM

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **ODM**: Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet, Rate Limiting, XSS Protection, NoSQL Injection Prevention
- **Validation**: Express Validator
- **Password Hashing**: bcryptjs

## Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Set up environment variables**
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   
   Update the `.env` file with your configuration:
   \`\`\`env
   NODE_ENV=development
   PORT=5000
   FRONTEND_URL=http://localhost:3000
   MONGODB_URI=mongodb://localhost:27017/engineering-resource-management
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRE=30d
   \`\`\`

4. **Start MongoDB**
   Make sure MongoDB is running on your system.

5. **Seed the database (optional)**
   \`\`\`bash
   npm run seed
   \`\`\`

6. **Start the server**
   \`\`\`bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   \`\`\`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout user

### Users
- `GET /api/users` - Get all users (Admin/Manager)
- `GET /api/users/:id` - Get single user
- `POST /api/users` - Create user (Admin)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete/deactivate user (Admin)
- `GET /api/users/stats/overview` - Get user statistics
- `GET /api/users/available-engineers` - Get available engineers

### Projects
- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get single project
- `POST /api/projects` - Create project (Admin/Manager)
- `PUT /api/projects/:id` - Update project (Admin/Manager)
- `DELETE /api/projects/:id` - Delete project (Admin/Manager)
- `POST /api/projects/:id/team-members` - Add team member
- `DELETE /api/projects/:id/team-members/:userId` - Remove team member
- `GET /api/projects/stats/overview` - Get project statistics

### Assignments
- `GET /api/assignments` - Get all assignments
- `GET /api/assignments/:id` - Get single assignment
- `POST /api/assignments` - Create assignment (Admin/Manager)
- `PUT /api/assignments/:id` - Update assignment
- `DELETE /api/assignments/:id` - Delete assignment (Admin/Manager)
- `POST /api/assignments/:id/comments` - Add comment
- `POST /api/assignments/:id/time-entries` - Add time entry
- `GET /api/assignments/stats/overview` - Get assignment statistics

### Engineers
- `GET /api/engineers` - Get all engineers (Admin/Manager)
- `GET /api/engineers/:id` - Get engineer details
- `PUT /api/engineers/:id/metrics` - Update engineer metrics
- `GET /api/engineers/:id/workload` - Get workload analysis

### Analytics
- `GET /api/analytics/dashboard` - Get dashboard analytics
- `GET /api/analytics/utilization` - Get resource utilization
- `GET /api/analytics/projects` - Get project performance
- `GET /api/analytics/time-tracking` - Get time tracking analytics

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Role-Based Access Control

- **Admin**: Full access to all resources
- **Manager**: Can manage projects and assignments, view engineers
- **Engineer**: Can view own assignments and projects, update assignment progress

## Security Features

1. **Rate Limiting**: Prevents abuse with configurable limits
2. **CORS Protection**: Configured for specific origins
3. **Helmet**: Sets various HTTP headers for security
4. **Data Sanitization**: Prevents NoSQL injection and XSS attacks
5. **Parameter Pollution Protection**: Prevents HPP attacks
6. **Password Hashing**: Uses bcrypt with configurable rounds
7. **Account Lockout**: Prevents brute force attacks

## Database Schema

### User Schema
- Personal information (name, email, phone, location)
- Role and permissions (admin, manager, engineer)
- Skills and experience level
- Availability and utilization metrics
- Authentication data (password, login attempts, lockout)

### Project Schema
- Project details (name, description, status, priority)
- Timeline and budget information
- Team members and their roles
- Milestones and attachments
- Progress tracking

### Assignment Schema
- Task details (title, description, priority)
- Project and assignee relationships
- Time tracking (estimated vs actual hours)
- Progress and status updates
- Comments and attachments

## Error Handling

The API includes comprehensive error handling:

- **Validation Errors**: Detailed field-level validation messages
- **Authentication Errors**: Clear auth-related error messages
- **Database Errors**: Proper handling of MongoDB errors
- **Rate Limiting**: Informative rate limit exceeded messages
- **404 Errors**: Clear not found messages

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run seed` - Seed database with sample data
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

### Sample Data
Run `npm run seed` to populate the database with sample data including:
- Admin user: `admin@company.com` / `admin123`
- Manager user: `sarah.chen@company.com` / `manager123`
- Engineer user: `alex.rodriguez@company.com` / `engineer123`

### Environment Variables
All configuration is handled through environment variables:

\`\`\`env
# Server
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/engineering-resource-management

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=30d

# Security
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=30

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
\`\`\`

## Deployment

### Production Checklist
1. Set `NODE_ENV=production`
2. Use strong JWT secret
3. Configure MongoDB connection string
4. Set up proper CORS origins
5. Configure rate limiting
6. Set up monitoring and logging
7. Use HTTPS in production
8. Set up database backups

### Docker Support
\`\`\`dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## License

This project is licensed under the MIT License.
\`\`\`

Now let's update the frontend to integrate with the backend. First, let's create an API service:
