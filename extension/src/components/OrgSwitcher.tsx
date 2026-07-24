"use client"

import { useOrganization } from '../contexts/OrganizationContext'

export function OrgSwitcher() {
  const { organizations, activeOrganizationId, setActiveOrganizationId, loading } = useOrganization()

  if (loading) {
    return <div className="text-[10px] text-slate-500">Loading...</div>
  }

  if (!organizations.length) {
    return <div className="text-[10px] text-slate-500">No orgs</div>
  }

  return (
    <select
      className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
      value={activeOrganizationId ?? ''}
      onChange={(e) => setActiveOrganizationId(e.target.value)}
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  )
}
