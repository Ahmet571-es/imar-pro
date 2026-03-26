"""
SaaS API Router — Kullanıcı profili, organizasyon, proje paylaşımı,
kullanım takibi, bildirimler, admin dashboard.

Supabase yapılandırılmamışsa demo mod çalışır (in-memory).
"""

import os
import time
import hashlib
import secrets
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field, EmailStr
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(tags=["SaaS"])

# ── Supabase Client (server-side) ──
_supabase_url = os.getenv("SUPABASE_URL", "")
_supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
_supabase = None


def _get_supabase():
    """Lazy Supabase client — service role (admin) erişimi."""
    global _supabase
    if _supabase:
        return _supabase
    if not _supabase_url or not _supabase_service_key:
        return None
    try:
        from supabase import create_client
        _supabase = create_client(_supabase_url, _supabase_service_key)
        return _supabase
    except Exception as e:
        logger.warning(f"Supabase bağlantı hatası: {e}")
        return None


def _get_user(request: Request) -> dict | None:
    """Request'ten kullanıcı bilgisini çıkar (JWT veya demo)."""
    from middleware import verify_supabase_token
    user = verify_supabase_token(request.headers.get("Authorization"))
    if user:
        return user
    # Demo mod — header'dan user_id al
    demo_id = request.headers.get("X-Demo-User-Id", "")
    if demo_id:
        return {"user_id": demo_id, "email": "demo@imarpro.dev", "role": "authenticated"}
    return None


def _require_user(request: Request) -> dict:
    """Oturum zorunlu — yoksa 401."""
    user = _get_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Oturum gerekli. Lütfen giriş yapın.")
    return user


def _require_admin(request: Request) -> dict:
    """Admin rolü zorunlu."""
    user = _require_user(request)
    sb = _get_supabase()
    if sb:
        try:
            result = sb.table("profiles").select("role").eq("id", user["user_id"]).single().execute()
            if result.data and result.data.get("role") in ("admin", "superadmin"):
                return user
        except Exception:
            pass
    # Demo modda admin kabul et
    if not sb:
        return user
    raise HTTPException(status_code=403, detail="Bu işlem admin yetkisi gerektirir.")


# ══════════════════════════════════════
# 1. PROFİL
# ══════════════════════════════════════

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    avatar_url: Optional[str] = None
    locale: Optional[str] = None
    onboarding_completed: Optional[bool] = None
    onboarding_step: Optional[int] = None


@router.get("/api/user/profile")
async def get_profile(request: Request):
    """Kullanıcı profilini getir."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb:
        try:
            result = sb.table("profiles").select("*").eq("id", user["user_id"]).single().execute()
            if result.data:
                # Son aktiflik güncelle
                sb.table("profiles").update({"last_active_at": datetime.utcnow().isoformat()}).eq("id", user["user_id"]).execute()
                return result.data
        except Exception as e:
            logger.error(f"Profil getirme hatası: {e}")

    # Demo fallback
    return {
        "id": user["user_id"],
        "email": user.get("email", "demo@imarpro.dev"),
        "full_name": "Demo Kullanıcı",
        "role": "user",
        "plan": "free",
        "max_projects": 3,
        "max_ai_calls_monthly": 10,
        "ai_calls_used": 0,
        "onboarding_completed": False,
        "onboarding_step": 0,
    }


@router.put("/api/user/profile")
async def update_profile(data: ProfileUpdate, request: Request):
    """Kullanıcı profilini güncelle."""
    user = _require_user(request)
    sb = _get_supabase()

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(400, "Güncellenecek alan yok")

    if sb:
        try:
            result = sb.table("profiles").update(update_data).eq("id", user["user_id"]).execute()
            return {"success": True, "updated": list(update_data.keys())}
        except Exception as e:
            raise HTTPException(500, f"Güncelleme hatası: {e}")

    return {"success": True, "updated": list(update_data.keys()), "mode": "demo"}


@router.get("/api/user/usage")
async def get_usage(request: Request):
    """Kullanıcının kullanım istatistikleri."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb:
        try:
            profile = sb.table("profiles").select("ai_calls_used, max_ai_calls_monthly, ai_calls_reset_at, max_projects, plan").eq("id", user["user_id"]).single().execute()
            project_count = sb.table("projects").select("id", count="exact").eq("user_id", user["user_id"]).execute()

            recent_usage = sb.table("usage_log").select("action, created_at").eq("user_id", user["user_id"]).order("created_at", desc=True).limit(20).execute()

            return {
                "plan": profile.data.get("plan", "free"),
                "projects": {"used": project_count.count or 0, "max": profile.data.get("max_projects", 3)},
                "ai_calls": {
                    "used": profile.data.get("ai_calls_used", 0),
                    "max": profile.data.get("max_ai_calls_monthly", 10),
                    "resets_at": profile.data.get("ai_calls_reset_at"),
                },
                "recent_actions": [{"action": u["action"], "date": u["created_at"]} for u in (recent_usage.data or [])],
            }
        except Exception as e:
            logger.error(f"Kullanım istatistik hatası: {e}")

    return {
        "plan": "free",
        "projects": {"used": 0, "max": 3},
        "ai_calls": {"used": 0, "max": 10, "resets_at": None},
        "recent_actions": [],
        "mode": "demo",
    }


# ══════════════════════════════════════
# 2. ORGANİZASYON
# ══════════════════════════════════════

class OrgCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=50, pattern=r'^[a-z0-9-]+$')


class OrgInvite(BaseModel):
    email: str
    role: str = Field(default="member")


@router.post("/api/org/create")
async def create_organization(data: OrgCreate, request: Request):
    """Yeni organizasyon oluştur."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb:
        try:
            # Slug benzersizlik kontrolü
            existing = sb.table("organizations").select("id").eq("slug", data.slug).execute()
            if existing.data:
                raise HTTPException(409, f"'{data.slug}' slug'ı zaten kullanılıyor")

            org = sb.table("organizations").insert({
                "name": data.name, "slug": data.slug, "owner_id": user["user_id"],
            }).execute()

            if org.data:
                org_id = org.data[0]["id"]
                # Sahibi otomatik üye yap
                sb.table("org_members").insert({
                    "org_id": org_id, "user_id": user["user_id"],
                    "role": "owner", "status": "active",
                    "accepted_at": datetime.utcnow().isoformat(),
                }).execute()
                return {"success": True, "org_id": org_id, "slug": data.slug}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"Organizasyon oluşturma hatası: {e}")

    return {"success": True, "org_id": f"demo-org-{int(time.time())}", "slug": data.slug, "mode": "demo"}


@router.get("/api/org/list")
async def list_organizations(request: Request):
    """Kullanıcının organizasyonlarını listele."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb:
        try:
            memberships = sb.table("org_members").select("org_id, role, organizations(id, name, slug, logo_url, plan, max_members)").eq("user_id", user["user_id"]).eq("status", "active").execute()
            return {"organizations": memberships.data or []}
        except Exception as e:
            logger.error(f"Org listesi hatası: {e}")

    return {"organizations": [], "mode": "demo"}


@router.post("/api/org/{org_id}/invite")
async def invite_member(org_id: str, data: OrgInvite, request: Request):
    """Organizasyona üye davet et."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb:
        try:
            # Yetki kontrolü
            membership = sb.table("org_members").select("role").eq("org_id", org_id).eq("user_id", user["user_id"]).single().execute()
            if not membership.data or membership.data["role"] not in ("owner", "admin"):
                raise HTTPException(403, "Davet yetkisi yok")

            # Davet edilen kullanıcıyı bul
            target = sb.table("profiles").select("id").eq("email", data.email).execute()
            if not target.data:
                raise HTTPException(404, f"'{data.email}' ile kayıtlı kullanıcı bulunamadı")

            target_id = target.data[0]["id"]

            # Zaten üye mi?
            existing = sb.table("org_members").select("id").eq("org_id", org_id).eq("user_id", target_id).execute()
            if existing.data:
                raise HTTPException(409, "Bu kullanıcı zaten üye")

            sb.table("org_members").insert({
                "org_id": org_id, "user_id": target_id,
                "role": data.role, "invited_by": user["user_id"],
                "status": "pending",
            }).execute()

            # Bildirim gönder
            sb.table("notifications").insert({
                "user_id": target_id, "type": "invite",
                "title": "Organizasyon Daveti",
                "message": f"Bir organizasyona davet edildiniz",
                "link": f"/org/{org_id}",
            }).execute()

            return {"success": True, "invited": data.email}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"Davet hatası: {e}")

    return {"success": True, "invited": data.email, "mode": "demo"}


# ══════════════════════════════════════
# 3. PROJE PAYLAŞIMI
# ══════════════════════════════════════

class ShareProject(BaseModel):
    email: str
    permission: str = Field(default="view")


@router.post("/api/project/{project_id}/share")
async def share_project(project_id: str, data: ShareProject, request: Request):
    """Projeyi başka kullanıcıyla paylaş."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb:
        try:
            # Proje sahibi mi?
            project = sb.table("projects").select("user_id").eq("id", project_id).single().execute()
            if not project.data or project.data["user_id"] != user["user_id"]:
                raise HTTPException(403, "Bu projeyi paylaşma yetkiniz yok")

            target = sb.table("profiles").select("id").eq("email", data.email).execute()
            if not target.data:
                raise HTTPException(404, f"'{data.email}' bulunamadı")

            target_id = target.data[0]["id"]
            sb.table("project_shares").upsert({
                "project_id": project_id, "shared_with": target_id,
                "permission": data.permission, "shared_by": user["user_id"],
            }).execute()

            sb.table("notifications").insert({
                "user_id": target_id, "type": "share",
                "title": "Proje Paylaşımı",
                "message": "Bir proje sizinle paylaşıldı",
                "link": f"/project/{project_id}",
            }).execute()

            return {"success": True, "shared_with": data.email, "permission": data.permission}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"Paylaşım hatası: {e}")

    return {"success": True, "shared_with": data.email, "mode": "demo"}


@router.post("/api/project/{project_id}/share-link")
async def generate_share_link(project_id: str, request: Request):
    """Proje için paylaşım linki oluştur."""
    user = _require_user(request)
    sb = _get_supabase()
    token = secrets.token_urlsafe(32)

    if sb:
        try:
            sb.table("projects").update({"share_token": token}).eq("id", project_id).eq("user_id", user["user_id"]).execute()
            return {"share_url": f"https://frontend-eta-kohl-48.vercel.app/shared/{token}", "token": token}
        except Exception as e:
            raise HTTPException(500, str(e))

    return {"share_url": f"/shared/{token}", "token": token, "mode": "demo"}


# ══════════════════════════════════════
# 4. BİLDİRİMLER
# ══════════════════════════════════════

@router.get("/api/notifications")
async def get_notifications(request: Request):
    """Kullanıcı bildirimlerini getir."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb:
        try:
            result = sb.table("notifications").select("*").eq("user_id", user["user_id"]).order("created_at", desc=True).limit(50).execute()
            unread = sum(1 for n in (result.data or []) if not n.get("is_read"))
            return {"notifications": result.data or [], "unread_count": unread}
        except Exception as e:
            logger.error(f"Bildirim hatası: {e}")

    return {"notifications": [], "unread_count": 0, "mode": "demo"}


@router.put("/api/notifications/read-all")
async def mark_all_read(request: Request):
    """Tüm bildirimleri okundu işaretle."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb:
        try:
            sb.table("notifications").update({"is_read": True}).eq("user_id", user["user_id"]).eq("is_read", False).execute()
        except Exception:
            pass

    return {"success": True}


# ══════════════════════════════════════
# 5. ADMIN DASHBOARD
# ══════════════════════════════════════

@router.get("/api/admin/dashboard")
async def admin_dashboard(request: Request):
    """Admin istatistik paneli — kullanıcı, proje, kullanım metrikleri."""
    _require_admin(request)
    sb = _get_supabase()

    if sb:
        try:
            # Temel sayaçlar
            users = sb.table("profiles").select("id", count="exact").execute()
            active_7d = sb.table("profiles").select("id", count="exact").gte("last_active_at", (datetime.utcnow() - timedelta(days=7)).isoformat()).execute()
            projects = sb.table("projects").select("id", count="exact").execute()
            projects_week = sb.table("projects").select("id", count="exact").gte("created_at", (datetime.utcnow() - timedelta(days=7)).isoformat()).execute()
            orgs = sb.table("organizations").select("id", count="exact").execute()

            # Plan dağılımı
            all_profiles = sb.table("profiles").select("plan").execute()
            plan_dist = {}
            for p in (all_profiles.data or []):
                plan = p.get("plan", "free")
                plan_dist[plan] = plan_dist.get(plan, 0) + 1

            # Son kullanım
            recent = sb.table("usage_log").select("action, created_at").order("created_at", desc=True).limit(50).execute()

            # Günlük aktif kullanıcı (son 14 gün)
            dau = []
            for i in range(14):
                day = datetime.utcnow() - timedelta(days=i)
                day_start = day.replace(hour=0, minute=0, second=0).isoformat()
                day_end = day.replace(hour=23, minute=59, second=59).isoformat()
                count = sb.table("profiles").select("id", count="exact").gte("last_active_at", day_start).lte("last_active_at", day_end).execute()
                dau.append({"date": day.strftime("%Y-%m-%d"), "users": count.count or 0})

            return {
                "total_users": users.count or 0,
                "active_users_7d": active_7d.count or 0,
                "total_projects": projects.count or 0,
                "projects_this_week": projects_week.count or 0,
                "total_organizations": orgs.count or 0,
                "plan_distribution": plan_dist,
                "daily_active_users": list(reversed(dau)),
                "recent_activity": [{"action": u["action"], "date": u["created_at"]} for u in (recent.data or [])],
            }
        except Exception as e:
            logger.error(f"Admin dashboard hatası: {e}")

    # Demo fallback
    return {
        "total_users": 1,
        "active_users_7d": 1,
        "total_projects": 0,
        "projects_this_week": 0,
        "total_organizations": 0,
        "plan_distribution": {"free": 1},
        "daily_active_users": [],
        "recent_activity": [],
        "mode": "demo",
    }


@router.get("/api/admin/users")
async def admin_list_users(request: Request):
    """Admin: tüm kullanıcıları listele."""
    _require_admin(request)
    sb = _get_supabase()

    if sb:
        try:
            result = sb.table("profiles").select("id, email, full_name, role, plan, ai_calls_used, last_active_at, created_at").order("created_at", desc=True).limit(100).execute()
            return {"users": result.data or [], "total": len(result.data or [])}
        except Exception as e:
            raise HTTPException(500, str(e))

    return {"users": [], "total": 0, "mode": "demo"}
