import { api } from "./api";
import type {
  ActivityPageData,
  AuthResponse,
  ChangePasswordPayload,
  CategoryStat,
  CompletePayload,
  ConsistencyPoint,
  Goal,
  GoalCreatePayload,
  GoalUpdatePayload,
  Habit,
  HabitCreatePayload,
  HabitHistoryData,
  HabitStatsData,
  HabitUpdatePayload,
  HeatmapCell,
  LoginPayload,
  Milestone,
  MilestoneCreatePayload,
  MilestoneUpdatePayload,
  OverviewData,
  RegisterPayload,
  ReviewData,
  ReviewUpsertPayload,
  TodayData,
  UserOut,
  UserUpdatePayload,
  XpPoint,
} from "./types";

/* ------------------------------- auth/user ------------------------------ */

export const register = (payload: RegisterPayload) =>
  api<AuthResponse>("/auth/register", { body: payload, auth: false });

export const login = (payload: LoginPayload) =>
  api<AuthResponse>("/auth/login", { body: payload, auth: false });

export const logout = (refreshToken?: string | null) =>
  api<void>("/auth/logout", {
    method: "POST",
    body: refreshToken ? { refreshToken } : undefined,
  });

export const fetchMe = () => api<UserOut>("/users/me");

export const updateMe = (payload: UserUpdatePayload) =>
  api<UserOut>("/users/me", { method: "PATCH", body: payload });

export const changePassword = (payload: ChangePasswordPayload) =>
  api<void>("/users/me/password", { method: "POST", body: payload });

/* ------------------------------- dashboard ------------------------------ */

export const fetchToday = () => api<TodayData>("/dashboard/today");

export const fetchDay = (day: string) => api<TodayData>(`/dashboard/${day}`);

/* -------------------------------- habits -------------------------------- */

export const fetchHabits = (activeOnly = false) =>
  api<Habit[]>(`/habits${activeOnly ? "?activeOnly=true" : ""}`);

export const fetchHabit = (id: string) => api<Habit>(`/habits/${id}`);

export const createHabit = (payload: HabitCreatePayload) =>
  api<Habit>("/habits", { method: "POST", body: payload });

export const updateHabit = (id: string, payload: HabitUpdatePayload) =>
  api<Habit>(`/habits/${id}`, { method: "PATCH", body: payload });

export const deleteHabit = (id: string) =>
  api<void>(`/habits/${id}`, { method: "DELETE" });

export const completeHabit = (id: string, payload?: CompletePayload) =>
  api<Habit>(`/habits/${id}/complete`, { method: "POST", body: payload ?? {} });

export const uncompleteHabit = (id: string, day: string) =>
  api<Habit>(`/habits/${id}/complete/${day}`, { method: "DELETE" });

export const fetchHabitHistory = (id: string, days = 90) =>
  api<HabitHistoryData>(`/habits/${id}/history?days=${days}`);

export const fetchHabitStats = (id: string, window = 90) =>
  api<HabitStatsData>(`/habits/${id}/stats?window=${window}`);

/* --------------------------------- goals -------------------------------- */

export const fetchGoals = (status?: string) =>
  api<Goal[]>(`/goals${status ? `?status=${status}` : ""}`);

export const fetchGoal = (id: string) => api<Goal>(`/goals/${id}`);

export const createGoal = (payload: GoalCreatePayload) =>
  api<Goal>("/goals", { method: "POST", body: payload });

export const updateGoal = (id: string, payload: GoalUpdatePayload) =>
  api<Goal>(`/goals/${id}`, { method: "PATCH", body: payload });

export const deleteGoal = (id: string) =>
  api<void>(`/goals/${id}`, { method: "DELETE" });

export const completeGoal = (id: string) =>
  api<Goal>(`/goals/${id}/complete`, { method: "POST" });

export const createMilestone = (goalId: string, payload: MilestoneCreatePayload) =>
  api<Milestone>(`/goals/${goalId}/milestones`, { method: "POST", body: payload });

export const updateMilestone = (id: string, payload: MilestoneUpdatePayload) =>
  api<Milestone>(`/milestones/${id}`, { method: "PATCH", body: payload });

export const deleteMilestone = (id: string) =>
  api<void>(`/milestones/${id}`, { method: "DELETE" });

export const completeMilestone = (id: string) =>
  api<Milestone>(`/milestones/${id}/complete`, { method: "POST" });

/* ------------------------------ reviews + feed --------------------------- */

export const fetchReview = (weekStart?: string) =>
  api<ReviewData>(`/reviews/weekly${weekStart ? `?weekStart=${weekStart}` : ""}`);

export const saveReview = (payload: ReviewUpsertPayload) =>
  api<ReviewData>("/reviews/weekly", { method: "PUT", body: payload });

export const fetchActivity = (limit = 30, cursor?: string) =>
  api<ActivityPageData>(
    `/activity?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
  );

/* ------------------------------- analytics ------------------------------- */

export const fetchOverview = () => api<OverviewData>("/analytics/overview");

export const fetchConsistency = (days = 90) =>
  api<ConsistencyPoint[]>(`/analytics/consistency?days=${days}`);

export const fetchXp = (days = 90) => api<XpPoint[]>(`/analytics/xp?days=${days}`);

export const fetchCategories = () => api<CategoryStat[]>("/analytics/categories");

export const fetchHeatmap = (months = 3) =>
  api<HeatmapCell[]>(`/analytics/heatmap?months=${months}`);
