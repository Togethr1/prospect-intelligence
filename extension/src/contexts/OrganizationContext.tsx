'use client'

import { createContext, useContext, useMemo, useState } from 'react'

type Organization = {
  id: string
  name: string
  research_prompt?: string | null
}

type OrganizationContextValue = {
  organizations: Organization[]
  activeOrganizationId: string | null
  activeOrganization: Organization | null
  setActiveOrganizationId: (id: string) => void
  loading: boolean
  error: string | null
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null)

const STORAGE_KEY = 'active_org_id'

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organizations] = useState<Organization[]>([{ id: 'local', name: 'Local workspace' }])
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string>('local')
  const loading = false
  const error = null

  const setActiveOrganizationId = (id: string) => {
    setActiveOrganizationIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  const activeOrganization = useMemo(() => {
    return organizations.find((org) => org.id === activeOrganizationId) || null
  }, [organizations, activeOrganizationId])

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        activeOrganizationId,
        activeOrganization,
        setActiveOrganizationId,
        loading,
        error,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext)
  if (!ctx) {
    throw new Error('useOrganization must be used within OrganizationProvider')
  }
  return ctx
}
