/** TypeScript mirrors of the API wire format (camelCase). */

export interface UserOut {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  weekStart: 1 | 7;
  createdAt: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
  timezone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: UserOut;
}

export interface UserUpdatePayload {
  displayName?: string;
  timezone?: string;
  weekStart?: number;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export type FrequencyType = "daily" | "custom_days" | "times_per_week";
export type Difficulty = "easy" | "medium" | "hard";
export type GoalCategory =
  | "health"
  | "mind"
  | "career"
  | "finance"
  | "relationships"
  | "creative"
  | "other";
export type GoalStatus = "active" | "completed" | "paused" | "archived";

export interface Habit {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  goalId: string | null;
  frequencyType: FrequencyType;
  frequencyDays: number[] | null;
  frequencyTarget: number | null;
  target: number;
  unit: string | null;
  difficulty: Difficulty;
  position: number;
  active: boolean;
  createdAt: string;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  atRisk: boolean;
  completions30d: number;
}

export interface HabitCreatePayload {
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  goalId?: string | null;
  frequencyType?: FrequencyType;
  frequencyDays?: number[];
  frequencyTarget?: number;
  target?: number;
  unit?: string;
  difficulty?: Difficulty;
}

export interface HabitUpdatePayload {
  title?: string;
  description?: string;
  icon?: string;
  color?: string;
  goalId?: string | null;
  frequencyType?: FrequencyType;
  frequencyDays?: number[];
  frequencyTarget?: number;
  target?: number;
  unit?: string;
  difficulty?: Difficulty;
  active?: boolean;
  position?: number;
}

export interface CompletePayload {
  date?: string;
  value?: number;
  note?: string;
}

export interface Completion {
  id: string;
  habitId: string;
  date: string;
  value: number;
  completed: boolean;
  note: string | null;
}

export interface HabitHistoryData {
  habitId: string;
  completions: Completion[];
  currentStreak: number;
  longestStreak: number;
}

export interface HabitStatsData {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  windowDays: number;
  scheduledInWindow: number;
  completedInWindow: number;
  completionRate: number;
  totalValue: number;
  lastCompletedDate: string | null;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  targetDate: string | null;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: GoalCategory;
  status: GoalStatus;
  targetDate: string | null;
  manualProgress: number;
  createdAt: string;
  updatedAt: string;
  progress: number;
  milestones: Milestone[];
  habitCount: number;
}

export interface MilestoneCreatePayload {
  title: string;
  targetDate?: string;
  sortOrder?: number;
}

export interface MilestoneUpdatePayload {
  title?: string;
  targetDate?: string;
  completed?: boolean;
  sortOrder?: number;
}

export interface GoalCreatePayload {
  title: string;
  description?: string;
  category?: GoalCategory;
  targetDate?: string;
  milestones?: MilestoneCreatePayload[];
}

export interface GoalUpdatePayload {
  title?: string;
  description?: string;
  category?: GoalCategory;
  status?: GoalStatus;
  targetDate?: string;
  manualProgress?: number;
}

export interface GoalSummaryMilestone {
  id: string;
  title: string;
  targetDate: string | null;
}

export interface GoalSummary {
  id: string;
  title: string;
  category: GoalCategory;
  status: GoalStatus;
  progress: number;
  targetDate: string | null;
  nextMilestone: GoalSummaryMilestone | null;
  habitCount: number;
}

export type DayState =
  | "fresh"
  | "on_track"
  | "ahead"
  | "falling_behind"
  | "at_risk"
  | "recovery"
  | "perfect"
  | "closed";

export type TimeOfDay = "morning" | "midday" | "evening" | "night";

export interface DayHabit {
  id: string;
  title: string;
  icon: string | null;
  color: string | null;
  goalId: string | null;
  goalTitle: string | null;
  target: number;
  unit: string | null;
  difficulty: Difficulty;
  frequencyType: FrequencyType;
  done: boolean;
  atRisk: boolean;
  currentStreak: number;
}

export interface DaySummary {
  scheduled: number;
  completed: number;
  remaining: number;
  completionRate: number;
  atRiskCount: number;
}

export interface Momentum {
  score: number;
  trend: string;
  change: number;
  factors: {
    consistency7d: number;
    bestStreak: number;
    goalProgress: number;
  };
}

export interface LevelInfo {
  level: number;
  totalXp: number;
  levelStartXp: number;
  nextLevelXp: number;
  currentLevelXp: number;
  xpForNextLevel: number;
  progress: number;
}

export interface WindowStats {
  scheduled: number;
  completed: number;
  rate: number;
}

export interface TodayData {
  date: string;
  timeOfDay: TimeOfDay | null;
  dayState: DayState;
  summary: DaySummary;
  habits: DayHabit[];
  goals: GoalSummary[];
  momentum: Momentum;
  level: LevelInfo;
  consistency: { today: WindowStats; week: WindowStats; month: WindowStats };
  perfectDay: { achieved: boolean; remaining: number; bonus: number };
}

export interface ActivityItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  habitId: string | null;
  goalId: string | null;
  createdAt: string;
}

export interface ActivityPageData {
  items: ActivityItem[];
  nextCursor: string | null;
}

export interface ReviewStats {
  scheduled: number;
  completed: number;
  rate: number;
  xp: number;
  perfectDays: number;
}

export interface ReviewData {
  id: string | null;
  weekStart: string;
  wentWell: string | null;
  toChange: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  stats: ReviewStats;
}

export interface ReviewUpsertPayload {
  weekStart: string;
  wentWell?: string;
  toChange?: string;
}

export interface HeatmapCell {
  date: string;
  level: number;
  scheduled: number;
  completed: number;
}

export interface ConsistencyPoint {
  date: string;
  scheduled: number;
  completed: number;
  rate: number;
}

export interface XpPoint {
  date: string;
  xp: number;
  cumulative: number;
}

export interface CategoryStat {
  category: GoalCategory;
  goals: number;
  habits: number;
  completions30d: number;
  avgGoalProgress: number;
}

export interface OverviewData {
  totalCompletions: number;
  activeHabits: number;
  totalHabits: number;
  activeGoals: number;
  completedGoals: number;
  bestCurrentStreak: number;
  perfectDays90d: number;
  totalXp: number;
}

export const GOAL_CATEGORIES: GoalCategory[] = [
  "health",
  "mind",
  "career",
  "finance",
  "relationships",
  "creative",
  "other",
];

export const FREQUENCY_TYPES: { value: FrequencyType; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "custom_days", label: "Specific weekdays" },
  { value: "times_per_week", label: "N times per week" },
];

export const DIFFICULTIES: { value: Difficulty; label: string; xp: number }[] = [
  { value: "easy", label: "Easy", xp: 10 },
  { value: "medium", label: "Medium", xp: 20 },
  { value: "hard", label: "Hard", xp: 30 },
];

/** ISO weekday numbers (1 = Monday … 7 = Sunday) with labels. */
export const WEEK_DAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "M" },
  { value: 2, label: "Tuesday", short: "Tu" },
  { value: 3, label: "Wednesday", short: "W" },
  { value: 4, label: "Thursday", short: "Th" },
  { value: 5, label: "Friday", short: "F" },
  { value: 6, label: "Saturday", short: "Sa" },
  { value: 7, label: "Sunday", short: "Su" },
];

export const HABIT_ICONS = [
  "droplets",
  "book-open",
  "dumbbell",
  "brain",
  "pencil",
  "heart",
  "coins",
  "leaf",
  "moon",
  "flame",
  "target",
  "star",
] as const;

export const HABIT_COLORS = [
  "#eab308",
  "#60a5fa",
  "#34d399",
  "#f472b6",
  "#fb7185",
  "#a78bfa",
  "#fbbf24",
  "#4ade80",
] as const;
