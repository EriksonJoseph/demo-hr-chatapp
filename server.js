const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

// Load environment variables
dotenv.config();

// Initialize express app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Set up middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Database setup
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hr_chatbot',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

console.log("dbConfig : ", dbConfig)

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Successfully connected to MySQL database');
        connection.release();
        return true;
    } catch (error) {
        console.error('Error connecting to MySQL database:', error);
        return false;
    }
}

// Initialize the database connection
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        console.log('Database connection established');
        
        // Check if tables exist, create them if they don't
        await connection.query(`
            CREATE TABLE IF NOT EXISTS employees (
                emp_id VARCHAR(10) PRIMARY KEY,
                first_name VARCHAR(50) NOT NULL,
                last_name VARCHAR(50) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                phone VARCHAR(20),
                department VARCHAR(50),
                position VARCHAR(50),
                hire_date DATE,
                salary DECIMAL(10,2)
            );
        `);
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                emp_id VARCHAR(10),
                date DATE NOT NULL,
                check_in TIME,
                check_out TIME,
                total_hours DECIMAL(5,2),
                status VARCHAR(20),
                FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
            );
        `);
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS leave_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                emp_id VARCHAR(10),
                leave_type VARCHAR(50),
                start_date DATE,
                end_date DATE,
                days INT,
                status VARCHAR(20) DEFAULT 'pending',
                applied_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
            );
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS payroll (
                id INT AUTO_INCREMENT PRIMARY KEY,
                emp_id VARCHAR(10),
                pay_period VARCHAR(10),
                basic_salary DECIMAL(10,2),
                overtime_pay DECIMAL(10,2) DEFAULT 0,
                bonus DECIMAL(10,2) DEFAULT 0,
                allowances DECIMAL(10,2) DEFAULT 0,
                deductions DECIMAL(10,2) DEFAULT 0,
                net_pay DECIMAL(10,2),
                pay_date DATE,
                FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
            );
        `);
        
        connection.release();
        console.log('Database schema verified/created');
        return true;
    } catch (error) {
        console.error('Database initialization error:', error);
        return false;
    }
}

// Track current active user
let currentUser = null;

// Helper functions for processing user queries
async function processUserQuery(query, empId) {
    try {
        // Convert query to lowercase for easier matching
        const lowerQuery = query.toLowerCase();
        
        // Check for different types of queries
        if (lowerQuery.includes('yesterday') && lowerQuery.includes('attendance')) {
            return await checkYesterdayAttendance(empId);
        } 
        else if (lowerQuery.includes('late') && lowerQuery.includes('yesterday')) {
            return await checkEmployeesLateYesterday();
        }
        else if (lowerQuery.includes('absent') && lowerQuery.includes('yesterday')) {
            return await checkEmployeesAbsentYesterday();
        }
        else if (lowerQuery.includes('leave') || lowerQuery.includes('ลาหยุด')) {
            return await checkLeaveStatus(empId);
        }
        else if (lowerQuery.includes('salary') || lowerQuery.includes('เงินเดือน')) {
            return await checkSalaryInfo(empId);
        }
        else if (lowerQuery.includes('department') || lowerQuery.includes('แผนก')) {
            return await getEmployeesByDepartment(query);
        }
        else {
            return 'ขออภัยค่ะ ฉันไม่เข้าใจคำถามของคุณ กรุณาลองใหม่อีกครั้งค่ะ';
        }
    } catch (error) {
        console.error('Error processing query:', error);
        return 'ขออภัยค่ะ เกิดข้อผิดพลาดในการประมวลผลคำขอ กรุณาลองใหม่อีกครั้งค่ะ';
    }
}

// Function to check yesterday's attendance for a specific employee
async function checkYesterdayAttendance(empId) {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const [attendance] = await pool.query(
            `SELECT date, check_in, check_out, total_hours, status 
             FROM attendance 
             WHERE emp_id = ? AND date = ?`,
            [empId, yesterdayStr]
        );

        const record = attendance[0];
        
        if (!record) {
            return `เมื่อวาน (${yesterdayStr}) ไม่มีข้อมูลการเข้างานของคุณค่ะ อาจเนื่องจากเป็นวันหยุด หรือข้อมูลยังไม่ถูกบันทึกค่ะ`;
        }
        
        if (record.status === 'absent') {
            return `เมื่อวาน (${yesterdayStr}) คุณไม่ได้มาทำงานค่ะ`;
        }
        
        let response = `เมื่อวาน (${yesterdayStr}) คุณ`;
        
        if (record.status === 'late') {
            response += `มาทำงานสาย เข้างานเวลา ${record.check_in} น. และเลิกงานเวลา ${record.check_out} น. รวมเวลาทำงาน ${record.total_hours} ชั่วโมงค่ะ`;
        } else {
            response += `มาทำงานเวลา ${record.check_in} น. และเลิกงานเวลา ${record.check_out} น. รวมเวลาทำงาน ${record.total_hours} ชั่วโมงค่ะ`;
        }
        
        return response;
    } catch (error) {
        console.error('Error checking yesterday\'s attendance:', error);
        return 'ขออภัยค่ะ เกิดข้อผิดพลาดในการค้นหาข้อมูลการเข้างานเมื่อวาน';
    }
}

// Function to check which employees were late yesterday
async function checkEmployeesLateYesterday() {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const [lateEmployees] = await pool.query(
            `SELECT a.emp_id, e.first_name, e.last_name, a.check_in, a.check_out, a.total_hours
             FROM attendance a
             JOIN employees e ON a.emp_id = e.emp_id
             WHERE a.date = ? AND a.status = 'late'
             ORDER BY a.check_in`,
            [yesterdayStr]
        );

        if (!lateEmployees || lateEmployees.length === 0) {
            return `เมื่อวาน (${yesterdayStr}) ไม่มีพนักงานมาสายค่ะ`;
        }

        let response = `เมื่อวาน (${yesterdayStr}) มีพนักงานมาสายทั้งหมด ${lateEmployees.length} คน ได้แก่:\n`;

        lateEmployees.forEach((emp, index) => {
            response += `${index + 1}. คุณ${emp.first_name} ${emp.last_name}\n`;
            response += `   - เข้างานเวลา: ${emp.check_in}\n`;
            response += `   - เลิกงานเวลา: ${emp.check_out}\n`;
            response += `   - รวมเวลาทำงาน: ${emp.total_hours} ชั่วโมง\n`;
        });

        return response;
    } catch (error) {
        console.error('Error checking late employees:', error);
        return 'ขออภัยค่ะ เกิดข้อผิดพลาดในการค้นหาข้อมูลการเข้างานเมื่อวาน';
    }
}

// Function to check which employees were absent yesterday
async function checkEmployeesAbsentYesterday() {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const [absentEmployees] = await pool.query(
            `SELECT e.emp_id, e.first_name, e.last_name 
             FROM employees e
             LEFT JOIN attendance a ON e.emp_id = a.emp_id AND a.date = ?
             WHERE a.emp_id IS NULL`,
            [yesterdayStr]
        );

        if (!absentEmployees || absentEmployees.length === 0) {
            return `เมื่อวาน (${yesterdayStr}) ไม่มีพนักงานขาดงานค่ะ`;
        }

        let response = `เมื่อวาน (${yesterdayStr}) มีพนักงานขาดงานทั้งหมด ${absentEmployees.length} คน ได้แก่:\n`;

        absentEmployees.forEach((emp, index) => {
            response += `${index + 1}. คุณ${emp.first_name} ${emp.last_name}\n`;
        });

        return response;
    } catch (error) {
        console.error('Error checking absent employees:', error);
        return 'ขออภัยค่ะ เกิดข้อผิดพลาดในการค้นหาข้อมูลการขาดงานเมื่อวาน';
    }
}

// Function to check leave status for an employee
async function checkLeaveStatus(empId) {
    try {
        const [rows] = await pool.query(
            `SELECT leave_type, start_date, end_date, days, status
             FROM leave_requests
             WHERE emp_id = ?
             ORDER BY applied_date DESC
             LIMIT 5`,
            [empId]
        );

        if (!rows || rows.length === 0) {
            return 'ไม่พบข้อมูลการลาของคุณในระบบค่ะ';
        }

        let response = 'ข้อมูลการลาล่าสุดของคุณ:\n';

        rows.forEach((leave, index) => {
            let statusThai = '';
            switch (leave.status) {
                case 'pending': statusThai = 'รออนุมัติ'; break;
                case 'approved': statusThai = 'อนุมัติแล้ว'; break;
                case 'rejected': statusThai = 'ไม่อนุมัติ'; break;
            }

            response += `${index + 1}. ${leave.leave_type} วันที่ ${leave.start_date} ถึง ${leave.end_date} (${leave.days} วัน) - สถานะ: ${statusThai}\n`;
        });

        return response;
    } catch (error) {
        console.error('Error checking leave status:', error);
        return 'ขออภัยค่ะ เกิดข้อผิดพลาดในการค้นหาข้อมูลการลา';
    }
}

// Function to check salary information for an employee
async function checkSalaryInfo(empId) {
    try {
        // First get employee salary
        const [rows] = await pool.query(
            'SELECT salary FROM employees WHERE emp_id = ?',
            [empId]
        );
        
        if (!rows || rows.length === 0) {
            return 'ไม่พบข้อมูลเงินเดือนของคุณในระบบค่ะ';
        }
        
        const employee = rows[0];
        
        // Then get latest payroll
        const [payrollRows] = await pool.query(
            `SELECT pay_period, basic_salary, overtime_pay, bonus, allowances, deductions, net_pay
             FROM payroll
             WHERE emp_id = ?
             ORDER BY pay_period DESC
             LIMIT 1`,
            [empId]
        );
        
        let response = 'ข้อมูลเงินเดือนของคุณ:\n';
        
        if (payrollRows && payrollRows.length > 0) {
            const latestPayroll = payrollRows[0];
            response += `- เงินเดือนพื้นฐาน: ${latestPayroll.basic_salary.toLocaleString()} บาท\n`;
            response += `- ค่าล่วงเวลา: ${latestPayroll.overtime_pay.toLocaleString()} บาท\n`;
            response += `- โบนัส: ${latestPayroll.bonus.toLocaleString()} บาท\n`;
            response += `- เงินเพิ่มเติม: ${latestPayroll.allowances.toLocaleString()} บาท\n`;
            response += `- เงินหัก: ${latestPayroll.deductions.toLocaleString()} บาท\n`;
            response += `- เงินเดือนสุทธิ: ${latestPayroll.net_pay.toLocaleString()} บาท\n`;
            response += `(ข้อมูล ณ วันที่ ${latestPayroll.pay_period})`;
        } else {
            response += `- เงินเดือนพื้นฐาน: ${employee.salary.toLocaleString()} บาท\n`;
            response += 'ยังไม่มีข้อมูลการคำนวณเงินเดือนล่าสุด';
        }
        
        return response;
    } catch (error) {
        console.error('Error getting salary info:', error);
        return 'ขออภัยค่ะ เกิดข้อผิดพลาดในการค้นหาข้อมูลเงินเดือน';
    }
}

// Function to get employees by department
async function getEmployeesByDepartment(query) {
    try {
        // Extract department from query
        let department = '';
        
        if (query.includes('it') || query.includes('ไอที') || query.includes('IT')) {
            department = 'IT';
        } else if (query.includes('การตลาด') || query.includes('Marketing') || query.includes('marketing')) {
            department = 'Marketing';
        } else if (query.includes('การเงิน') || query.includes('Finance') || query.includes('finance')) {
            department = 'Finance';
        } else if (query.includes('ขาย') || query.includes('Sales') || query.includes('sales')) {
            department = 'Sales';
        } else if (query.includes('hr') || query.includes('ทรัพยากรบุคคล') || query.includes('HR')) {
            department = 'HR';
        } else {
            return 'กรุณาระบุแผนกที่ต้องการดูข้อมูล เช่น แผนก IT, แผนกการตลาด, แผนกการเงิน, แผนกขาย หรือแผนก HR';
        }
        
        const [employees] = await pool.query(
            `SELECT emp_id, first_name, last_name, position
             FROM employees
             WHERE department = ?
             ORDER BY position, first_name`,
            [department]
        );
        
        if (!employees || employees.length === 0) {
            return `ไม่พบพนักงานในแผนก ${department} ค่ะ`;
        }
        
        let response = `พนักงานในแผนก ${department} มีทั้งหมด ${employees.length} คน ได้แก่:\n`;
        
        employees.forEach((emp, index) => {
            response += `${index + 1}. คุณ${emp.first_name} ${emp.last_name} - ตำแหน่ง: ${emp.position}\n`;
        });
        
        return response;
    } catch (error) {
        console.error('Error getting department employees:', error);
        return 'ขออภัยค่ะ เกิดข้อผิดพลาดในการค้นหาข้อมูล';
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Handle employee login
    socket.on('login', async (empId) => {
        try {
            // Check if someone else is already logged in
            if (currentUser && currentUser.socketId !== socket.id) {
                socket.emit('login_response', { 
                    success: false, 
                    message: 'Another user is currently using the system. Please try again later.' 
                });
                return;
            }
            
            try {
                // Validate employee ID using MySQL
                const [rows] = await pool.query(
                    'SELECT emp_id, first_name, last_name, department, position FROM employees WHERE emp_id = ?',
                    [empId]
                );
                
                const employee = rows[0];
                
                if (!employee) {
                    // Send failure response if employee not found
                    socket.emit('login_response', { 
                        success: false, 
                        message: 'ไม่พบข้อมูลพนักงานในระบบ กรุณาตรวจสอบรหัสพนักงานและลองใหม่อีกครั้งค่ะ' 
                    });
                    return;
                }
                
                // Set current user
                currentUser = {
                    socketId: socket.id,
                    empId: employee.emp_id,
                    name: `${employee.first_name} ${employee.last_name}`,
                    department: employee.department,
                    position: employee.position
                };
                
                // Send success response
                socket.emit('login_response', { 
                    success: true, 
                    employee: currentUser 
                });
                
                console.log(`Employee logged in: ${currentUser.name} (ID: ${currentUser.empId})`);
            } catch (error) {
                console.error('Database error:', error);
                socket.emit('login_response', { 
                    success: false, 
                    message: 'ขออภัยค่ะ เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้งค่ะ' 
                });
            }
        } catch (error) {
            console.error('Login error:', error);
            socket.emit('login_response', { 
                success: false, 
                message: 'ขออภัยค่ะ เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้งค่ะ' 
            });
        }
    });

    // Handle chat messages
    socket.on('chat_message', async (message) => {
        try {
            // Check if user is logged in
            if (!currentUser || currentUser.socketId !== socket.id) {
                socket.emit('chat_response', { 
                    success: false, 
                    message: 'You need to log in first.' 
                });
                return;
            }

            console.log(`Message from ${currentUser.name}: ${message}`);
            
            // Process the message and generate response
            const response = await processUserQuery(message, currentUser.empId);
            
            // Send response
            socket.emit('chat_response', { 
                success: true, 
                message: response 
            });
        } catch (error) {
            console.error('Message processing error:', error);
            socket.emit('chat_response', { 
                success: false, 
                message: 'ขออภัยค่ะ เกิดข้อผิดพลาดในการประมวลผลคำถามของคุณ กรุณาลองใหม่อีกครั้งค่ะ' 
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        if (currentUser && currentUser.socketId === socket.id) {
            console.log(`User disconnected: ${currentUser.name}`);
            currentUser = null;
        } else {
            console.log('Unidentified client disconnected');
        }
    });
});

// Close the connection pool when the server is shutting down
process.on('SIGINT', () => {
    pool.end();
    process.exit();
});

// Initialize the application
async function initializeApp() {
    try {
        // Test database connection first
        const isConnected = await testConnection();
        if (!isConnected) {
            console.error('❌ Failed to connect to database. Please check your database configuration.');
            process.exit(1);
        }

        // Initialize database schema
        console.log('🔄 Initializing database schema...');
        const dbInitialized = await initializeDatabase();
        if (!dbInitialized) {
            console.error('❌ Failed to initialize database schema. Exiting...');
            process.exit(1);
        }
        console.log('✅ Database schema initialized successfully');

        // Start the server
        await startServer();
    } catch (error) {
        console.error('❌ Error initializing application:', error.message);
        process.exit(1);
    }
}

// Test database connection
async function testConnection() {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.ping();
        console.log('Database connection successful');
        return true;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        return false;
    } finally {
        if (connection) connection.release();
    }
}

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const isConnected = await testConnection();
        if (isConnected) {
            res.status(200).json({
                status: 'ok',
                database: 'connected',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                status: 'error',
                database: 'disconnected',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            error: error.message
        });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;

async function startServer() {
    // Verify database connection before starting the server
    const isConnected = await testConnection();
    if (!isConnected) {
        console.error('❌ Failed to connect to database. Server will not start.');
        process.exit(1);
    }

    server.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`🔍 Health check available at http://localhost:${PORT}/health`);
    });
}

// Start the application
initializeApp();

// Export for testing
module.exports = {
    app,
    server,
    startServer,
    initializeDatabase,
    initializeApp
};