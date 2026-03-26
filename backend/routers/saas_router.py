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
        user["is_demo"] = False
        return user
    # Demo mod — header'dan user_id al
    demo_id = request.headers.get("X-Demo-User-Id", "")
    if demo_id:
        return {"user_id": demo_id, "email": "demo@imarpro.dev", "role": "authenticated", "is_demo": True}
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


# ══════════════════════════════════════
# 6. ŞİFRE SIFIRLAMA
# ══════════════════════════════════════

class PasswordResetRequest(BaseModel):
    email: str


class PasswordUpdate(BaseModel):
    current_password: Optional[str] = None
    new_password: str = Field(..., min_length=8, max_length=128)


@router.post("/api/auth/reset-password")
async def request_password_reset(data: PasswordResetRequest):
    """Şifre sıfırlama emaili gönder."""
    sb = _get_supabase()
    if not sb:
        return {"success": True, "message": "Demo modda şifre sıfırlama devre dışı", "mode": "demo"}

    try:
        sb.auth.admin.generate_link({
            "type": "recovery",
            "email": data.email,
            "options": {"redirect_to": "https://frontend-eta-kohl-48.vercel.app/"},
        })
        return {"success": True, "message": "Şifre sıfırlama linki email adresinize gönderildi"}
    except Exception as e:
        # Güvenlik: email var/yok bilgisi verme
        return {"success": True, "message": "Eğer bu email kayıtlıysa, şifre sıfırlama linki gönderildi"}


@router.put("/api/user/password")
async def update_password(data: PasswordUpdate, request: Request):
    """Şifre değiştir (giriş yapmış kullanıcı)."""
    user = _require_user(request)
    sb = _get_supabase()

    if not sb:
        return {"success": True, "mode": "demo"}

    try:
        # Admin API ile şifre güncelle
        sb.auth.admin.update_user_by_id(user["user_id"], {"password": data.new_password})
        return {"success": True, "message": "Şifre başarıyla güncellendi"}
    except Exception as e:
        raise HTTPException(400, f"Şifre güncelleme hatası: {str(e)}")


# ══════════════════════════════════════
# 7. DAVET KABUL / REDDET
# ══════════════════════════════════════

@router.post("/api/org/invite/{invite_id}/accept")
async def accept_invite(invite_id: str, request: Request):
    """Organizasyon davetini kabul et."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb:
        try:
            # Davet kontrolü
            invite = sb.table("org_members").select("*").eq("id", invite_id).eq("user_id", user["user_id"]).eq("status", "pending").single().execute()
            if not invite.data:
                raise HTTPException(404, "Davet bulunamadı veya zaten işlenmiş")

            sb.table("org_members").update({
                "status": "active",
                "accepted_at": datetime.utcnow().isoformat(),
            }).eq("id", invite_id).execute()

            return {"success": True, "org_id": invite.data["org_id"]}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, str(e))

    return {"success": True, "mode": "demo"}


@router.post("/api/org/invite/{invite_id}/reject")
async def reject_invite(invite_id: str, request: Request):
    """Organizasyon davetini reddet."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb:
        try:
            sb.table("org_members").update({"status": "revoked"}).eq("id", invite_id).eq("user_id", user["user_id"]).execute()
            return {"success": True}
        except Exception as e:
            raise HTTPException(500, str(e))

    return {"success": True, "mode": "demo"}


@router.get("/api/org/{org_id}/members")
async def list_org_members(org_id: str, request: Request):
    """Organizasyon üyelerini listele."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb:
        try:
            members = sb.table("org_members").select(
                "id, role, status, accepted_at, profiles(id, email, full_name, avatar_url)"
            ).eq("org_id", org_id).order("accepted_at", desc=True).execute()
            return {"members": members.data or []}
        except Exception as e:
            raise HTTPException(500, str(e))

    return {"members": [], "mode": "demo"}


# ══════════════════════════════════════
# 8. ADMIN KULLANICI YÖNETİMİ
# ══════════════════════════════════════

class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    plan: Optional[str] = None
    max_projects: Optional[int] = None
    max_ai_calls_monthly: Optional[int] = None
    is_active: Optional[bool] = None


@router.put("/api/admin/users/{user_id}")
async def admin_update_user(user_id: str, data: AdminUserUpdate, request: Request):
    """Admin: kullanıcı bilgilerini güncelle (plan, rol, limitler)."""
    _require_admin(request)
    sb = _get_supabase()

    if not sb:
        return {"success": True, "mode": "demo"}

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(400, "Güncellenecek alan yok")

    # is_active → Supabase Auth ban/unban
    if "is_active" in update_data:
        try:
            is_active = update_data.pop("is_active")
            if not is_active:
                sb.auth.admin.update_user_by_id(user_id, {"ban_duration": "876000h"})  # ~100 yıl ban
            else:
                sb.auth.admin.update_user_by_id(user_id, {"ban_duration": "none"})
        except Exception as e:
            logger.warning(f"User ban/unban hatası: {e}")

    if update_data:
        try:
            sb.table("profiles").update(update_data).eq("id", user_id).execute()
        except Exception as e:
            raise HTTPException(500, str(e))

    return {"success": True, "updated": list(data.model_dump(exclude_none=True).keys())}


@router.get("/api/admin/audit")
async def admin_audit_log(request: Request):
    """Admin: son denetim kayıtları."""
    _require_admin(request)
    sb = _get_supabase()

    if sb:
        try:
            result = sb.table("usage_log").select(
                "id, user_id, action, metadata, tokens_used, duration_ms, created_at"
            ).order("created_at", desc=True).limit(100).execute()
            return {"logs": result.data or [], "total": len(result.data or [])}
        except Exception as e:
            raise HTTPException(500, str(e))

    return {"logs": [], "total": 0, "mode": "demo"}


# ══════════════════════════════════════
# 9. PROJE CRUD (Supabase)
# ══════════════════════════════════════

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    il: str = Field(default="")
    ilce: str = Field(default="")


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    status: Optional[str] = None
    data: Optional[dict] = None
    il: Optional[str] = None
    ilce: Optional[str] = None


@router.post("/api/projects")
async def create_project(data: ProjectCreate, request: Request):
    """Yeni proje oluştur."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb and not user.get("is_demo"):
        try:
            result = sb.table("projects").insert({
                "user_id": user["user_id"],
                "name": data.name,
                "description": data.description,
                "il": data.il,
                "ilce": data.ilce,
            }).execute()
            if result.data:
                return {"success": True, "project": result.data[0]}
        except Exception as e:
            if "Proje limiti" in str(e):
                raise HTTPException(403, "Proje limitiniz doldu. Pro plana yükseltin.")
            raise HTTPException(500, str(e))

    # Demo
    return {"success": True, "project": {"id": f"demo-{int(time.time())}", "name": data.name}, "mode": "demo"}


@router.get("/api/projects")
async def list_projects(request: Request):
    """Kullanıcının projelerini listele."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb and not user.get("is_demo"):
        try:
            result = sb.table("projects").select("*").eq("user_id", user["user_id"]).order("updated_at", desc=True).execute()
            return {"projects": result.data or []}
        except Exception as e:
            raise HTTPException(500, str(e))

    return {"projects": [], "mode": "demo"}


@router.get("/api/projects/{project_id}")
async def get_project(project_id: str, request: Request):
    """Tek proje detayı getir."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb and not user.get("is_demo"):
        try:
            result = sb.table("projects").select("*").eq("id", project_id).single().execute()
            if not result.data:
                raise HTTPException(404, "Proje bulunamadı")
            # Yetki kontrolü
            if result.data["user_id"] != user["user_id"]:
                # Paylaşım kontrolü
                share = sb.table("project_shares").select("id").eq("project_id", project_id).eq("shared_with", user["user_id"]).execute()
                if not share.data:
                    raise HTTPException(403, "Bu projeye erişim yetkiniz yok")
            return {"project": result.data}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, str(e))

    return {"project": None, "mode": "demo"}


@router.put("/api/projects/{project_id}")
async def update_project(project_id: str, data: ProjectUpdate, request: Request):
    """Proje güncelle."""
    user = _require_user(request)
    sb = _get_supabase()

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(400, "Güncellenecek alan yok")

    if sb and not user.get("is_demo"):
        try:
            result = sb.table("projects").update(update_data).eq("id", project_id).eq("user_id", user["user_id"]).execute()
            return {"success": True, "updated": list(update_data.keys())}
        except Exception as e:
            raise HTTPException(500, str(e))

    return {"success": True, "mode": "demo"}


@router.delete("/api/projects/{project_id}")
async def delete_project(project_id: str, request: Request):
    """Proje sil."""
    user = _require_user(request)
    sb = _get_supabase()

    if sb and not user.get("is_demo"):
        try:
            sb.table("projects").delete().eq("id", project_id).eq("user_id", user["user_id"]).execute()
            return {"success": True}
        except Exception as e:
            raise HTTPException(500, str(e))

    return {"success": True, "mode": "demo"}


# ══════════════════════════════════════
# 10. SİSTEM SAĞLIĞI
# ══════════════════════════════════════

@router.get("/api/system/health")
async def system_health():
    """Detaylı sistem sağlığı — DB, Auth, Cache durumu."""
    sb = _get_supabase()
    checks = {
        "api": "ok",
        "supabase_configured": bool(sb),
        "supabase_connected": False,
        "auth_working": False,
        "tables_ok": False,
    }

    if sb:
        try:
            # DB bağlantı testi
            result = sb.table("profiles").select("id", count="exact").limit(0).execute()
            checks["supabase_connected"] = True
            checks["tables_ok"] = True
        except Exception:
            pass

        try:
            # Auth testi
            settings = sb.auth.get_settings() if hasattr(sb.auth, 'get_settings') else None
            checks["auth_working"] = True
        except Exception:
            checks["auth_working"] = checks["supabase_connected"]

    checks["overall"] = "healthy" if all([
        checks["api"] == "ok",
        checks["supabase_configured"],
        checks["supabase_connected"],
    ]) else "degraded" if checks["api"] == "ok" else "unhealthy"

    return checks
