/**
 * OrgPanel — Organizasyon yönetimi.
 * Org oluştur, üyeleri listele, davet gönder, davet kabul/red.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import {
  listOrganizations, createOrganization, getOrgMembers,
  inviteToOrg, acceptInvite, rejectInvite,
} from '@/services/api'
import { toast } from '@/stores/toastStore'
import {
  Building2, Users, UserPlus, Check, X, Loader2, Plus, ChevronDown, ChevronUp, Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Org {
  org_id: string
  role: string
  organizations: { id: string; name: string; slug: string; plan: string; max_members: number }
}

interface Member {
  id: string
  role: string
  status: string
  accepted_at: string | null
  profiles: { id: string; email: string; full_name: string; avatar_url: string }
}

export function OrgPanel() {
  const { user } = useAuthStore()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)

  useEffect(() => { loadOrgs() }, [])

  const loadOrgs = async () => {
    setLoading(true)
    try {
      const data = await listOrganizations()
      setOrgs((data.organizations || []) as unknown as Org[])
    } catch { /* sessiz */ }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newSlug.trim()) return
    try {
      await createOrganization(newName.trim(), newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'))
      toast.success('Organizasyon Oluşturuldu', newName.trim())
      setShowCreate(false)
      setNewName('')
      setNewSlug('')
      loadOrgs()
    } catch (e) {
      toast.error('Hata', e instanceof Error ? e.message : 'Oluşturulamadı')
    }
  }

  const loadMembers = async (orgId: string) => {
    if (selectedOrg === orgId) { setSelectedOrg(null); return }
    setSelectedOrg(orgId)
    try {
      const data = await getOrgMembers(orgId)
      setMembers((data.members || []) as unknown as Member[])
    } catch { setMembers([]) }
  }

  const handleInvite = async () => {
    if (!selectedOrg || !inviteEmail.trim()) return
    setInviting(true)
    try {
      await inviteToOrg(selectedOrg, inviteEmail.trim(), inviteRole)
      toast.success('Davet Gönderildi', inviteEmail.trim())
      setInviteEmail('')
      loadMembers(selectedOrg)
    } catch (e) {
      toast.error('Davet Hatası', e instanceof Error ? e.message : 'Gönderilemedi')
    }
    setInviting(false)
  }

  const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    owner: { label: 'Sahip', color: 'bg-violet-100 text-violet-700' },
    admin: { label: 'Yönetici', color: 'bg-sky-100 text-sky-700' },
    member: { label: 'Üye', color: 'bg-slate-100 text-slate-600' },
    viewer: { label: 'İzleyici', color: 'bg-slate-50 text-slate-500' },
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-sky-600" />
          Organizasyonlarım
        </h3>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition">
          <Plus className="w-4 h-4" /> Yeni
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Organizasyon adı" className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <input type="text" value={newSlug} onChange={e => setNewSlug(e.target.value)}
              placeholder="URL slug (ör: firma-adi)" className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" />
            <button onClick={handleCreate} className="px-4 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700">Oluştur</button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700">İptal</button>
          </div>
        </div>
      )}

      {/* Org list */}
      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400">Henüz organizasyonunuz yok</div>
      ) : (
        <div className="space-y-2">
          {orgs.map(org => {
            const o = org.organizations
            if (!o) return null
            const isSelected = selectedOrg === o.id
            const roleInfo = ROLE_LABELS[org.role] || ROLE_LABELS.member

            return (
              <div key={o.id} className="border rounded-xl overflow-hidden">
                <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
                  onClick={() => loadMembers(o.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-sky-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm text-slate-800">{o.name}</div>
                      <div className="text-xs text-slate-400">{o.slug}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', roleInfo.color)}>{roleInfo.label}</span>
                    {isSelected ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {isSelected && (
                  <div className="border-t px-4 py-3 bg-slate-50 space-y-3">
                    {/* Üye listesi */}
                    <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> Üyeler ({members.length})
                    </div>
                    {members.length > 0 ? (
                      <div className="space-y-1.5">
                        {members.map(m => (
                          <div key={m.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                {m.profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <div className="font-medium text-slate-700 text-xs">{m.profiles?.full_name || '—'}</div>
                                <div className="text-[10px] text-slate-400">{m.profiles?.email}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded', (ROLE_LABELS[m.role] || ROLE_LABELS.member).color)}>
                                {(ROLE_LABELS[m.role] || ROLE_LABELS.member).label}
                              </span>
                              {m.status === 'pending' && <span className="text-[10px] text-amber-600">Bekliyor</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">Üye bulunamadı</div>
                    )}

                    {/* Davet */}
                    {(org.role === 'owner' || org.role === 'admin') && (
                      <div className="pt-2 border-t">
                        <div className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                          <UserPlus className="w-3.5 h-3.5" /> Üye Davet Et
                        </div>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                              placeholder="email@ornek.com" className="w-full pl-8 pr-2 py-1.5 border rounded-lg text-xs" />
                          </div>
                          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                            className="border rounded-lg px-2 py-1.5 text-xs">
                            <option value="member">Üye</option>
                            <option value="admin">Yönetici</option>
                            <option value="viewer">İzleyici</option>
                          </select>
                          <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                            className="px-3 py-1.5 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700 disabled:opacity-50">
                            {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Davet'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
