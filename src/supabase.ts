import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          emp_id: number
          first_name: string
          last_name: string
          department: string
          position: string
          hire_date: string
          salary: number
          phone: string
          email: string
          status: string
          created_date: string
          updated_date: string
        }
      }
      attendance: {
        Row: {
          attendance_id: number
          emp_id: number
          date: string
          check_in: string | null
          check_out: string | null
          total_hours: number
          status: string
          notes: string | null
        }
      }
      leave_requests: {
        Row: {
          leave_id: number
          emp_id: number
          leave_type: string
          start_date: string
          end_date: string
          days: number
          reason: string
          status: string
          applied_date: string
          approved_by: number | null
          approved_date: string | null
        }
      }
      payroll: {
        Row: {
          payroll_id: number
          emp_id: number
          pay_period: string
          basic_salary: number
          overtime_pay: number
          bonus: number
          allowances: number
          deductions: number
          net_pay: number
          pay_date: string
        }
      }
      benefits: {
        Row: {
          benefit_id: number
          emp_id: number
          social_security: number
          health_insurance: number
          life_insurance: number
          provident_fund: number
          annual_leave_days: number
          sick_leave_days: number
          personal_leave_days: number
          effective_date: string
        }
      }
    }
  }
}