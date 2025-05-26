# HR Chatbot Demo

This is a simple demo chatbot application that allows employees to query HR database information using natural language. The application is built with Node.js, Express, Socket.io, and SQLite.

## Features

- Single-user chat interface (only one employee can be logged in at a time)
- Natural language queries about:
  - Attendance information
  - Leave requests
  - Salary information
  - Department information
  - Employee information
- Responsive design for desktop and mobile

## Technology Stack

- **Backend:** Node.js, Express
- **Database:** SQLite (via better-sqlite3)
- **Real-time Communication:** Socket.io
- **Frontend:** HTML, CSS, JavaScript

## Setup Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server:
   ```
   npm start
   ```
   
   For development with auto-reload:
   ```
   npm run dev
   ```

3. Access the application in your browser:
   ```
   http://localhost:3000
   ```

## Usage

1. Log in with any employee ID from the database (e.g., 1, 2, 3, etc.)
2. Ask questions in natural language:
   - "เมื่อวานฉันมาทำงานกี่โมง" (What time did I arrive at work yesterday?)
   - "เมื่อวานมีใครมาสายบ้าง" (Who was late yesterday?)
   - "เมื่อวานมีใครขาดงานบ้าง" (Who was absent yesterday?)
   - "ข้อมูลการลาของฉัน" (My leave information)
   - "เงินเดือนของฉัน" (My salary information)
   - "พนักงานในแผนก IT มีใครบ้าง" (Who are the employees in the IT department?)

## Limitations

- This is a demo application with simplified NLP capabilities
- Only one user can be active at a time
- The database contains mock data for demonstration purposes

## Database Schema

The application uses a SQLite database with the following tables:
- employees: Employee information
- attendance: Daily attendance records
- leave_requests: Leave applications
- payroll: Salary and payment records
- benefits: Employee benefits
- user_mappings: LINE user mapping (for potential integration)

## License

This project is for demonstration purposes only.
