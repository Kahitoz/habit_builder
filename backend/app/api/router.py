"""Aggregate all API routers."""

from fastapi import APIRouter

from app.api.routes import (
    activity,
    analytics,
    auth,
    dashboard,
    goals,
    habits,
    milestones,
    reviews,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(habits.router)
api_router.include_router(goals.router)
api_router.include_router(milestones.router)
api_router.include_router(dashboard.router)
api_router.include_router(analytics.router)
api_router.include_router(activity.router)
api_router.include_router(reviews.router)
