-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
    emp_id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    hire_date TEXT NOT NULL, -- DATE as TEXT in SQLite
    salary REAL NOT NULL,
    phone TEXT,
    email TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'resigned')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
    att_id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- DATE as TEXT in SQLite
    check_in TEXT, -- TIME as TEXT in SQLite
    check_out TEXT, -- TIME as TEXT in SQLite
    total_hours REAL DEFAULT 0,
    status TEXT DEFAULT 'present' CHECK(status IN ('present', 'absent', 'late', 'half_day')),
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    leave_id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER NOT NULL,
    leave_type TEXT NOT NULL CHECK(leave_type IN ('ลาป่วย', 'ลากิจ', 'ลาพักร้อน', 'ลาคลอด', 'ลาฉุกเฉิน')),
    start_date TEXT NOT NULL, -- DATE as TEXT in SQLite
    end_date TEXT NOT NULL, -- DATE as TEXT in SQLite
    days INTEGER NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    applied_date TEXT DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INTEGER,
    reviewed_date TEXT,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);

-- Create payroll table
CREATE TABLE IF NOT EXISTS payroll (
    payroll_id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER NOT NULL,
    pay_period TEXT NOT NULL, -- Format: YYYY-MM
    basic_salary REAL NOT NULL,
    overtime_pay REAL DEFAULT 0,
    bonus REAL DEFAULT 0,
    allowances REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    net_pay REAL NOT NULL,
    pay_date TEXT NOT NULL, -- DATE as TEXT in SQLite
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);

-- Create benefits table
CREATE TABLE IF NOT EXISTS benefits (
    benefit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER NOT NULL,
    social_security REAL DEFAULT 0,
    health_insurance REAL DEFAULT 0,
    life_insurance REAL DEFAULT 0,
    provident_fund REAL DEFAULT 0,
    annual_leave_days INTEGER DEFAULT 6,
    sick_leave_days INTEGER DEFAULT 30,
    personal_leave_days INTEGER DEFAULT 3,
    effective_date TEXT NOT NULL, -- DATE as TEXT in SQLite
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);

-- Create user_mappings table (for LINE Bot integration)
CREATE TABLE IF NOT EXISTS user_mappings (
    mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
    line_user_id TEXT NOT NULL UNIQUE,
    emp_id INTEGER NOT NULL,
    is_verified INTEGER DEFAULT 0, -- BOOLEAN as INTEGER in SQLite
    created_date TEXT DEFAULT CURRENT_TIMESTAMP,
    last_used TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);

-- Insert sample employees data
INSERT OR IGNORE INTO employees (emp_id, first_name, last_name, department, position, hire_date, salary, phone, email) VALUES
(1, 'สมชาย', 'ใจดี', 'IT', 'Software Developer', '2022-01-15', 45000.00, '081-234-5678', 'somchai@company.com'),
(2, 'สมหญิง', 'รักงาน', 'HR', 'HR Manager', '2021-03-10', 55000.00, '081-345-6789', 'somying@company.com'),
(3, 'ธนากร', 'เก่งมาก', 'IT', 'System Analyst', '2022-06-01', 48000.00, '081-456-7890', 'thanakorn@company.com'),
(4, 'นิภา', 'สุขใจ', 'Sales', 'Sales Executive', '2021-09-20', 35000.00, '081-567-8901', 'nipha@company.com'),
(5, 'วิทยา', 'ชาญฉลาด', 'Marketing', 'Marketing Specialist', '2022-02-28', 40000.00, '081-678-9012', 'withaya@company.com'),
(6, 'ปรีชา', 'มั่นคง', 'Finance', 'Accountant', '2020-12-01', 42000.00, '081-789-0123', 'preecha@company.com'),
(7, 'สุดา', 'อุตสาห์', 'HR', 'HR Officer', '2023-01-10', 32000.00, '081-890-1234', 'suda@company.com'),
(8, 'กฤษณ์', 'พัฒนา', 'IT', 'Network Administrator', '2021-08-15', 46000.00, '081-901-2345', 'krit@company.com'),
(9, 'มาลี', 'ขยัน', 'Sales', 'Sales Manager', '2020-05-12', 52000.00, '081-012-3456', 'malee@company.com'),
(10, 'ประสิทธิ์', 'เรียนรู้', 'Marketing', 'Digital Marketing Manager', '2021-11-08', 50000.00, '081-123-4567', 'prasit@company.com'),
(11, 'อนันต์', 'สร้างสรรค์', 'Finance', 'Finance Manager', '2019-07-22', 58000.00, '081-234-5670', 'anan@company.com'),
(12, 'รัตนา', 'ละเอียด', 'IT', 'Database Administrator', '2022-04-18', 47000.00, '081-345-6781', 'rattana@company.com'),
(13, 'สมเกียรติ', 'ซื่อสัตย์', 'Sales', 'Sales Representative', '2023-02-14', 30000.00, '081-456-7892', 'somkiat@company.com');

-- Insert attendance data (representative sample for January-March 2024)
-- January 2024 - Sample days
INSERT OR IGNORE INTO attendance (emp_id, date, check_in, check_out, total_hours, status) VALUES
-- Jan 2
(1,'2024-01-02','08:30:00','17:30:00',8.0,'present'),
(2,'2024-01-02','08:15:00','17:45:00',8.5,'present'),
(3,'2024-01-02','08:35:00','17:30:00',7.92,'present'),
-- Jan 3 (Employee 1 late)
(1,'2024-01-03','08:45:00','17:30:00',7.75,'late'),
(2,'2024-01-03','08:30:00','17:30:00',8.0,'present'),
(3,'2024-01-03','08:30:00','17:30:00',8.0,'present'),
-- Jan 8 (Employee 1 absent)
(1,'2024-01-08',NULL,NULL,0,'absent'),
(2,'2024-01-08','08:30:00','17:30:00',8.0,'present'),
(3,'2024-01-08','08:30:00','17:30:00',8.0,'present'),
-- Jan 10 (Employee 7 absent)
(1,'2024-01-10','08:30:00','17:30:00',8.0,'present'),
(2,'2024-01-10','08:30:00','17:30:00',8.0,'present'),
(7,'2024-01-10',NULL,NULL,0,'absent'),
-- Feb 14-16 (Employee 3 vacation)
(1,'2024-02-14','08:30:00','17:30:00',8.0,'present'),
(2,'2024-02-14','08:30:00','17:30:00',8.0,'present'),
(3,'2024-02-14',NULL,NULL,0,'absent'),
(1,'2024-02-15','08:30:00','17:30:00',8.0,'present'),
(2,'2024-02-15','08:30:00','17:30:00',8.0,'present'),
(3,'2024-02-15',NULL,NULL,0,'absent'),
-- Feb 20-21 (Employee 4 sick leave)
(1,'2024-02-20','08:30:00','17:30:00',8.0,'present'),
(2,'2024-02-20','08:30:00','17:30:00',8.0,'present'),
(4,'2024-02-20',NULL,NULL,0,'absent'),
(1,'2024-02-21','08:30:00','17:30:00',8.0,'present'),
(2,'2024-02-21','08:30:00','17:30:00',8.0,'present'),
(4,'2024-02-21',NULL,NULL,0,'absent'),
-- Mar 11 (Employee 5 personal leave)
(1,'2024-03-11','08:30:00','17:30:00',8.0,'present'),
(2,'2024-03-11','08:30:00','17:30:00',8.0,'present'),
(5,'2024-03-11',NULL,NULL,0,'absent'),
-- Mar 25-29 (Employee 1 vacation)
(1,'2024-03-25',NULL,NULL,0,'absent'),
(2,'2024-03-25','08:30:00','17:30:00',8.0,'present'),
(1,'2024-03-26',NULL,NULL,0,'absent'),
(2,'2024-03-26','08:30:00','17:30:00',8.0,'present'),
-- Generate yesterday's data for all employees
(1,'2024-05-25','08:30:00','17:30:00',8.0,'present'),
(2,'2024-05-25','08:30:00','17:30:00',8.0,'present'),
(3,'2024-05-25','08:30:00','17:30:00',8.0,'present'),
(4,'2024-05-25','08:45:00','17:30:00',7.75,'late'),
(5,'2024-05-25','08:30:00','17:30:00',8.0,'present'),
(6,'2024-05-25',NULL,NULL,0,'absent'),
(7,'2024-05-25','08:30:00','17:30:00',8.0,'present'),
(8,'2024-05-25','09:00:00','17:30:00',7.5,'late'),
(9,'2024-05-25','08:30:00','17:30:00',8.0,'present'),
(10,'2024-05-25','08:30:00','17:30:00',8.0,'present'),
(11,'2024-05-25','08:30:00','17:30:00',8.0,'present'),
(12,'2024-05-25','08:30:00','17:30:00',8.0,'present'),
(13,'2024-05-25',NULL,NULL,0,'absent');

-- Insert sample leave requests
INSERT OR IGNORE INTO leave_requests (emp_id, leave_type, start_date, end_date, days, reason, status, applied_date) VALUES
(1, 'ลาป่วย', '2024-01-08', '2024-01-08', 1, 'ไข้หวัด', 'approved', '2024-01-07 14:30:00'),
(2, 'ลากิจ', '2024-01-15', '2024-01-15', 1, 'ธุระส่วนตัว', 'approved', '2024-01-10 09:15:00'),
(3, 'ลาพักร้อน', '2024-02-14', '2024-02-16', 3, 'เที่ยวกับครอบครัว', 'approved', '2024-02-01 10:00:00'),
(4, 'ลาป่วย', '2024-02-20', '2024-02-21', 2, 'ป่วยหนัก', 'approved', '2024-02-19 16:45:00'),
(5, 'ลากิจ', '2024-03-10', '2024-03-10', 1, 'ไปโรงพยาบาล', 'approved', '2024-03-08 11:20:00'),
(1, 'ลาพักร้อน', '2024-03-25', '2024-03-29', 5, 'พักร้อนประจำปี', 'approved', '2024-03-15 13:00:00'),
(6, 'ลาป่วย', '2024-01-22', '2024-01-23', 2, 'โรคกระเพาะ', 'approved', '2024-01-21 08:30:00'),
(6, 'ลาป่วย', '2024-05-25', '2024-05-25', 1, 'ไข้หวัดใหญ่', 'approved', '2024-05-24 09:30:00'),
(13, 'ลาป่วย', '2024-05-25', '2024-05-25', 1, 'ไปหาหมอ', 'approved', '2024-05-24 10:15:00');

-- Insert sample payroll data
INSERT OR IGNORE INTO payroll (emp_id, pay_period, basic_salary, overtime_pay, bonus, allowances, deductions, net_pay, pay_date) VALUES
-- January 2024 payroll
(1, '2024-01', 45000.00, 2250.00, 0.00, 3000.00, 4500.00, 45750.00, '2024-01-31'),
(2, '2024-01', 55000.00, 0.00, 5000.00, 3000.00, 5500.00, 57500.00, '2024-01-31'),
(3, '2024-01', 48000.00, 1440.00, 0.00, 3000.00, 4800.00, 47640.00, '2024-01-31'),
-- February 2024 payroll
(1, '2024-02', 45000.00, 1800.00, 0.00, 3000.00, 4500.00, 45300.00, '2024-02-29'),
(2, '2024-02', 55000.00, 0.00, 0.00, 3000.00, 5500.00, 52500.00, '2024-02-29'),
(3, '2024-02', 48000.00, 2160.00, 1000.00, 3000.00, 4800.00, 49360.00, '2024-02-29'),
-- March 2024 payroll
(1, '2024-03', 45000.00, 2700.00, 2000.00, 3000.00, 4500.00, 48200.00, '2024-03-31'),
(2, '2024-03', 55000.00, 0.00, 3000.00, 3000.00, 5500.00, 55500.00, '2024-03-31'),
(3, '2024-03', 48000.00, 1440.00, 0.00, 3000.00, 4800.00, 47640.00, '2024-03-31'),
-- April 2024 payroll
(1, '2024-04', 45000.00, 1350.00, 0.00, 3000.00, 4500.00, 44850.00, '2024-04-30'),
(2, '2024-04', 55000.00, 0.00, 0.00, 3000.00, 5500.00, 52500.00, '2024-04-30'),
(3, '2024-04', 48000.00, 960.00, 0.00, 3000.00, 4800.00, 47160.00, '2024-04-30');

-- Insert sample benefits data
INSERT OR IGNORE INTO benefits (emp_id, social_security, health_insurance, life_insurance, provident_fund, annual_leave_days, sick_leave_days, personal_leave_days, effective_date) VALUES
(1, 750.00, 2000.00, 500.00, 2250.00, 6, 30, 3, '2024-01-01'),
(2, 750.00, 2500.00, 750.00, 2750.00, 10, 30, 3, '2024-01-01'),
(3, 750.00, 2000.00, 600.00, 2400.00, 6, 30, 3, '2024-01-01'),
(4, 750.00, 1500.00, 400.00, 1750.00, 6, 30, 3, '2024-01-01'),
(5, 750.00, 1800.00, 500.00, 2000.00, 6, 30, 3, '2024-01-01'),
(6, 750.00, 1800.00, 500.00, 2100.00, 6, 30, 3, '2024-01-01'),
(7, 750.00, 1400.00, 350.00, 1600.00, 6, 30, 3, '2024-01-01'),
(8, 750.00, 2000.00, 550.00, 2300.00, 6, 30, 3, '2024-01-01'),
(9, 750.00, 2200.00, 650.00, 2600.00, 8, 30, 3, '2024-01-01'),
(10, 750.00, 2100.00, 600.00, 2500.00, 8, 30, 3, '2024-01-01'),
(11, 750.00, 2500.00, 750.00, 2900.00, 10, 30, 3, '2024-01-01'),
(12, 750.00, 2000.00, 550.00, 2350.00, 6, 30, 3, '2024-01-01'),
(13, 750.00, 1300.00, 350.00, 1500.00, 6, 30, 3, '2024-01-01');

-- Insert sample user mappings
INSERT OR IGNORE INTO user_mappings (line_user_id, emp_id, is_verified) VALUES
('U1234567890abcdef1234567890abcdef', 1, 1),
('U2345678901bcdef12345678901bcdef1', 2, 1),
('U3456789012cdef123456789012cdef12', 3, 1),
('U4567890123def1234567890123def123', 4, 1),
('U5678901234ef12345678901234ef1234', 5, 1);

-- Create view for employee summary (if needed)
CREATE VIEW IF NOT EXISTS employee_summary AS
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name as full_name,
    e.department,
    e.position,
    e.salary,
    e.status,
    b.annual_leave_days,
    b.sick_leave_days,
    um.line_user_id,
    um.is_verified as line_verified
FROM employees e
LEFT JOIN benefits b ON e.emp_id = b.emp_id
LEFT JOIN user_mappings um ON e.emp_id = um.emp_id;

-- Create view for monthly attendance summary
CREATE VIEW IF NOT EXISTS monthly_attendance_summary AS
SELECT 
    e.emp_id,
    e.first_name || ' ' || e.last_name as full_name,
    e.department,
    strftime('%Y', a.date) as year,
    strftime('%m', a.date) as month,
    COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
    COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
    COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
    ROUND(AVG(a.total_hours), 2) as avg_hours
FROM employees e
LEFT JOIN attendance a ON e.emp_id = a.emp_id
GROUP BY e.emp_id, strftime('%Y', a.date), strftime('%m', a.date);
