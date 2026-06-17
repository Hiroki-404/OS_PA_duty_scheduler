export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; kakao_id: string; employee_id: string; name: string; is_admin: boolean; is_active: boolean; color: string; created_at: string; updated_at: string }
        Insert: { id: string; kakao_id: string; employee_id: string; name: string; is_admin?: boolean; is_active?: boolean; color?: string }
        Update: { kakao_id?: string; employee_id?: string; name?: string; is_admin?: boolean; is_active?: boolean; color?: string; updated_at?: string }
        Relationships: []
      }
      availability_requests: {
        Row: { id: string; user_id: string; year: number; month: number; date: string; type: 'exclude' | 'half_day' | 'annual_leave'; submitted_at: string | null; created_at: string }
        Insert: { user_id: string; year: number; month: number; date: string; type: 'exclude' | 'half_day' | 'annual_leave'; submitted_at?: string | null }
        Update: { type?: 'exclude' | 'half_day' | 'annual_leave'; submitted_at?: string | null }
        Relationships: []
      }
      schedules: {
        Row: { id: string; user_id: string; date: string; is_weekend: boolean; is_holiday: boolean; is_locked: boolean; created_by: string | null; created_at: string; updated_at: string }
        Insert: { user_id: string; date: string; is_weekend: boolean; is_holiday: boolean; is_locked?: boolean; created_by?: string | null }
        Update: { user_id?: string; is_locked?: boolean; updated_at?: string }
        Relationships: []
      }
      monthly_balance: {
        Row: { id: string; user_id: string; year: number; month: number; total_duties: number; weekday_duties: number; weekend_duties: number; holiday_duties: number; dow_0: number; dow_1: number; dow_2: number; dow_3: number; dow_4: number; dow_5: number; dow_6: number; is_initial_month: boolean; created_at: string }
        Insert: { user_id: string; year: number; month: number; total_duties: number; weekday_duties: number; weekend_duties: number; holiday_duties: number; dow_0: number; dow_1: number; dow_2: number; dow_3: number; dow_4: number; dow_5: number; dow_6: number; is_initial_month?: boolean }
        Update: Partial<Database['public']['Tables']['monthly_balance']['Insert']>
        Relationships: []
      }
      exchange_requests: {
        Row: { id: string; requester_id: string; target_id: string; requester_date: string; target_date: string | null; type: 'swap' | 'transfer'; status: 'pending' | 'accepted' | 'rejected' | 'cancelled'; expires_at: string; requested_at: string; responded_at: string | null; created_at: string }
        Insert: { requester_id: string; target_id: string; requester_date: string; target_date?: string | null; type: 'swap' | 'transfer'; expires_at: string }
        Update: { status?: 'accepted' | 'rejected' | 'cancelled'; responded_at?: string }
        Relationships: []
      }
      holiday_cache: {
        Row: { id: string; date: string; name: string; year: number; created_at: string }
        Insert: { date: string; name: string; year: number }
        Update: { name?: string }
        Relationships: []
      }
      notifications: {
        Row: { id: string; receiver_id: string; title: string; content: string; landing_tab: string; is_read: boolean; created_at: string }
        Insert: { receiver_id: string; title: string; content: string; landing_tab?: string; is_read?: boolean }
        Update: { is_read?: boolean }
        Relationships: []
      }
      user_push_tokens: {
        Row: { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; created_at: string }
        Insert: { user_id: string; endpoint: string; p256dh: string; auth: string }
        Update: { p256dh?: string; auth?: string }
        Relationships: []
      }
      worker_periods: {
        Row: { id: string; user_id: string; start_date: string; end_date: string | null; note: string | null; created_at: string }
        Insert: { user_id: string; start_date: string; end_date?: string | null; note?: string | null }
        Update: { end_date?: string | null; note?: string | null }
        Relationships: []
      }
      monthly_submission_flags: {
        Row: { user_id: string; year: number; month: number; submitted_at: string }
        Insert: { user_id: string; year: number; month: number; submitted_at?: string }
        Update: { submitted_at?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
