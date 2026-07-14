from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from backend.api import auth, consent, dashboard, doctor, profile, questionnaire, session
from backend.app.config import get_settings
from backend.database.mongodb import close_mongo_connection, connect_to_mongo, ensure_indexes
from backend.database.mongodb import get_database
from backend.services.auth import bootstrap_researcher

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_to_mongo()
    await ensure_indexes()
    await bootstrap_researcher(get_database())
    yield
    await close_mongo_connection()


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

routers = [auth.router, profile.router, consent.router, session.router,
           questionnaire.router, doctor.router, dashboard.router]
for router in routers:
    app.include_router(router, prefix=settings.api_prefix)


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok", "database": "mongodb"}


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(url=f"{settings.frontend_url}/researcher/login")
