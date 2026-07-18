export type UserRole = 'coach' | 'client'

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export type ClientStatus = 'active' | 'inactive' | 'new' | 'onboarding' | 'course' | 'followup' | 'app_access'

export interface CoachClient {
  id: string
  coach_id: string
  client_id: string
  status: ClientStatus
  created_at: string
  profile?: Profile
}

// Training

export interface Exercise {
  id: string
  exercise_id?: string
  name: string
  sets: number
  reps: string
  weight: string
  rest: string
  notes: string
  video_url?: string | null
}

export interface TrainingSession {
  id: string
  training_plan_id: string
  day_of_week: number // 1=Mon … 7=Sun
  title: string
  exercises: Exercise[]
  created_at: string
}

export interface TrainingPlan {
  id: string
  client_id: string
  coach_id: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  created_at: string
  sessions?: TrainingSession[]
}

// Nutrition

export interface Food {
  name: string
  amount: string          // canonical gram string e.g. "120g" — used for all computation
  amount_display?: string // smart display label e.g. "2 stk" or "2 dl"
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MealAlternative {
  name?: string        // descriptive name derived from ingredients
  foods: Food[]
  recipe?: string[]
  image_url?: string
}

export interface Meal {
  name: string
  time?: string
  foods: Food[]           // primary / backward-compat
  alternatives?: MealAlternative[]  // 7 / 14 / 21 alternatives
  image_url?: string
  recipe?: string[]
}

export type MealStructure = '3' | '3+snack' | '4' | '4+snacks'

export interface MealPlan {
  id: string
  client_id: string
  coach_id: string
  title: string
  calories_target: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  meals: Meal[]
  is_active: boolean
  created_at: string
}

// Client phases

export interface ClientPhase {
  id: string
  coach_id: string
  client_id: string
  name: string
  color: string
  phase_type: string | null
  description: string | null
  start_date: string   // ISO date "YYYY-MM-DD"
  end_date: string | null
  notes: string | null
  training_plan_id: string | null
  meal_plan_id: string | null
  created_at: string
}

// Check-ins

export type QuestionType = 'text' | 'scale' | 'yesno'

export interface CheckinQuestion {
  id:       string
  text:     string
  type:     QuestionType
  required?: boolean
}

export interface CheckinTemplate {
  id: string
  coach_id: string
  name: string
  type: 'daily' | 'weekly' | 'onboarding'
  questions: CheckinQuestion[]
  schedule_days: number[]          // 0=Mon … 6=Sun; only used for weekly
  schedule_time: string | null     // "HH:MM:SS" from postgres TIME; null if unset
  created_at: string
}

export interface Checkin {
  id: string
  client_id: string
  template_id: string | null
  type: 'daily' | 'weekly' | 'onboarding'
  answers: Record<string, string | number | boolean>
  mood: number | null
  notes: string | null
  weight_kg: number | null
  sleep_hours: number | null
  steps: number | null
  energy_level: number | null
  created_at: string
  profile?: Profile
  template?: CheckinTemplate
}

// Food search (Matvaretabellen)

export interface FoodSearchResult {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

// AI meal plan generation

export interface MealPlanGenerateRequest {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  meal_structure?: MealStructure
  custom_meal_names?: string[]
  /** fraction per meal name (0–1), must sum to 1; defaults to equal split */
  meal_calorie_splits?: Record<string, number>
  alternatives_per_meal: number
  preferences?: string
  meals_per_day?: number  // backward compat
}
