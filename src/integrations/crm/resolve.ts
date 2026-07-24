import { getCredential, listIntegrationSummaries } from '../credential-broker'
import type { CrmAccountContext, CrmContact, CrmOpportunity } from '../types'
import { httpUrl, object, providerJson, text } from '../intelligence/provider-http'
import { resolveHubSpotDomain } from './hubspot'

type JsonCredential = Record<string, unknown>

function credentialJson(value: string, provider: string): JsonCredential {
    try {
        const parsed = JSON.parse(value)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
        return parsed
    } catch {
        throw new Error(`${provider} expects the JSON connection object shown in Settings.`)
    }
}

function trustedBase(value: unknown, provider: string, suffixes: string[]) {
    const raw = text(value, 1_000)
    let url: URL
    try { url = new URL(raw) } catch { throw new Error(`${provider} connection URL is invalid.`) }
    const host = url.hostname.toLowerCase()
    if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        (url.pathname && url.pathname !== '/') ||
        url.search ||
        url.hash ||
        !suffixes.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix))
    ) {
        throw new Error(`${provider} connection URL is not an approved provider host.`)
    }
    return `${url.protocol}//${url.hostname}`
}

function none(provider: string): CrmAccountContext {
    return { provider, match: 'none', contacts: [], opportunities: [], observedAt: new Date().toISOString() }
}

function exact(
    provider: string,
    domain: string,
    account: Omit<NonNullable<CrmAccountContext['account']>, 'domain'>,
    contacts: CrmContact[] = [],
    opportunities: CrmOpportunity[] = [],
): CrmAccountContext {
    return { provider, match: 'exact-domain', account: { ...account, domain }, contacts, opportunities, observedAt: new Date().toISOString() }
}

async function salesforce(domain: string, raw: string) {
    const credential = credentialJson(raw, 'Salesforce')
    const base = trustedBase(credential.instanceUrl, 'Salesforce', ['.my.salesforce.com', '.salesforce.com'])
    const token = text(credential.accessToken, 4_096)
    if (!token) throw new Error('Salesforce accessToken is required.')
    const query = async (soql: string) => providerJson(`${base}/services/data/v65.0/query?q=${encodeURIComponent(soql)}`, {
        headers: { authorization: `Bearer ${token}` },
    }, 'Salesforce')
    const accounts = await query(`SELECT Id,Name,Website,Industry,BillingCity,BillingState,BillingCountry,Owner.Name FROM Account WHERE Website LIKE '%${domain.replace(/'/g, "\\'")}%' LIMIT 2`)
    const account = (Array.isArray(accounts.records) ? accounts.records : []).map(object).find((row) => {
        try { return new URL(/^https?:/i.test(text(row.Website)) ? text(row.Website) : `https://${text(row.Website)}`).hostname.replace(/^www\./, '') === domain } catch { return false }
    })
    if (!account) return none('salesforce')
    const accountId = text(account.Id, 100)
    if (!/^[a-z0-9]{15,18}$/i.test(accountId)) {
        throw new Error('Salesforce returned an invalid account identifier.')
    }
    const [contactData, opportunityData] = await Promise.all([
        query(`SELECT Id,Name,Title,Email,Phone FROM Contact WHERE AccountId='${accountId}' LIMIT 10`),
        query(`SELECT Id,Name,StageName,Amount,CloseDate FROM Opportunity WHERE AccountId='${accountId}' LIMIT 10`),
    ])
    return exact('salesforce', domain, {
        id: accountId, name: text(account.Name) || domain, industry: text(account.Industry) || undefined,
        city: text(account.BillingCity) || undefined, state: text(account.BillingState) || undefined,
        country: text(account.BillingCountry) || undefined, owner: text(object(account.Owner).Name) || undefined,
        sourceUrl: `${base}/${accountId}`,
    }, (Array.isArray(contactData.records) ? contactData.records : []).map((rawContact) => {
        const row = object(rawContact)
        return { id: text(row.Id), name: text(row.Name) || 'Unnamed contact', title: text(row.Title) || undefined, email: text(row.Email) || undefined, phone: text(row.Phone) || undefined }
    }), (Array.isArray(opportunityData.records) ? opportunityData.records : []).map((rawOpportunity) => {
        const row = object(rawOpportunity)
        return { id: text(row.Id), name: text(row.Name) || 'Unnamed opportunity', stage: text(row.StageName) || undefined, amount: row.Amount === undefined ? undefined : String(row.Amount), closeDate: text(row.CloseDate) || undefined }
    }))
}

async function attio(domain: string, token: string) {
    const data = await providerJson('https://api.attio.com/v2/objects/companies/records/query', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ filter: { domains: { domain: { $eq: domain } } }, limit: 2 }),
    }, 'Attio')
    const rows = Array.isArray(data.data) ? data.data : []
    const row = object(rows[0])
    if (!text(row.id, 100)) return none('attio')
    const values = object(row.values)
    const first = (key: string) => object(Array.isArray(values[key]) ? values[key][0] : undefined)
    return exact('attio', domain, {
        id: text(row.id), name: text(first('name').value) || domain,
        industry: text(first('categories').option) || undefined,
        city: text(first('primary_location').locality) || undefined,
        state: text(first('primary_location').region) || undefined,
        country: text(first('primary_location').country_code) || undefined,
    })
}

async function closeCrm(domain: string, token: string) {
    const basic = Buffer.from(`${token}:`).toString('base64')
    const data = await providerJson('https://api.close.com/api/v1/lead/?_limit=100&_fields=id,name,url,contacts,opportunities,addresses,html_url', {
        headers: { authorization: `Basic ${basic}` },
    }, 'Close')
    const leads = (Array.isArray(data.data) ? data.data : []).map(object)
    const lead = leads.find((row) => {
        const urls = Array.isArray(row.url) ? row.url : [row.url]
        return urls.some((candidate) => {
            const value = typeof candidate === 'string' ? candidate : text(object(candidate).url)
            try { return new URL(/^https?:/i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, '') === domain } catch { return false }
        })
    })
    if (!lead) return none('close')
    const contacts = (Array.isArray(lead.contacts) ? lead.contacts : []).map((rawContact): CrmContact => {
        const row = object(rawContact)
        const emails = Array.isArray(row.emails) ? row.emails : []
        const phones = Array.isArray(row.phones) ? row.phones : []
        return { id: text(row.id), name: text(row.name) || 'Unnamed contact', title: text(row.title) || undefined, email: text(object(emails[0]).email) || undefined, phone: text(object(phones[0]).phone) || undefined }
    })
    const opportunities = (Array.isArray(lead.opportunities) ? lead.opportunities : []).map((rawOpportunity): CrmOpportunity => {
        const row = object(rawOpportunity)
        return { id: text(row.id), name: text(row.note) || 'Opportunity', stage: text(row.status_label) || undefined, amount: row.value === undefined ? undefined : String(row.value), closeDate: text(row.date_won) || undefined }
    })
    const address = object((Array.isArray(lead.addresses) ? lead.addresses : [])[0])
    return exact('close', domain, {
        id: text(lead.id), name: text(lead.name) || domain, city: text(address.city) || undefined,
        state: text(address.state) || undefined, country: text(address.country) || undefined,
        sourceUrl: httpUrl(lead.html_url) || undefined,
    }, contacts, opportunities)
}

async function zoho(domain: string, raw: string) {
    const credential = credentialJson(raw, 'Zoho CRM')
    const base = trustedBase(credential.apiDomain || 'https://www.zohoapis.com', 'Zoho CRM', [
        '.zohoapis.com', '.zohoapis.eu', '.zohoapis.in', '.zohoapis.com.au', '.zohoapis.jp', '.zohoapis.ca', '.zohoapis.sa',
    ])
    const token = text(credential.accessToken, 4_096)
    if (!token) throw new Error('Zoho CRM accessToken is required.')
    const headers = { authorization: `Zoho-oauthtoken ${token}` }
    const accounts = await providerJson(`${base}/crm/v8/Accounts/search?criteria=${encodeURIComponent(`(Website:equals:${domain})`)}&fields=Account_Name,Website,Industry,Billing_City,Billing_State,Billing_Country,Owner`, { headers }, 'Zoho CRM')
    const account = object((Array.isArray(accounts.data) ? accounts.data : [])[0])
    if (!text(account.id, 100)) return none('zoho')
    const id = text(account.id, 100)
    const [contactsData, dealsData] = await Promise.all([
        providerJson(`${base}/crm/v8/Contacts/search?criteria=${encodeURIComponent(`(Account_Name:equals:${id})`)}&fields=Full_Name,Title,Email,Phone`, { headers }, 'Zoho CRM'),
        providerJson(`${base}/crm/v8/Deals/search?criteria=${encodeURIComponent(`(Account_Name:equals:${id})`)}&fields=Deal_Name,Stage,Amount,Closing_Date`, { headers }, 'Zoho CRM'),
    ])
    return exact('zoho', domain, {
        id, name: text(account.Account_Name) || domain, industry: text(account.Industry) || undefined,
        city: text(account.Billing_City) || undefined, state: text(account.Billing_State) || undefined,
        country: text(account.Billing_Country) || undefined, owner: text(object(account.Owner).name) || undefined,
    }, (Array.isArray(contactsData.data) ? contactsData.data : []).map((rawContact) => {
        const row = object(rawContact)
        return { id: text(row.id), name: text(row.Full_Name) || 'Unnamed contact', title: text(row.Title) || undefined, email: text(row.Email) || undefined, phone: text(row.Phone) || undefined }
    }), (Array.isArray(dealsData.data) ? dealsData.data : []).map((rawDeal) => {
        const row = object(rawDeal)
        return { id: text(row.id), name: text(row.Deal_Name) || 'Unnamed deal', stage: text(row.Stage) || undefined, amount: row.Amount === undefined ? undefined : String(row.Amount), closeDate: text(row.Closing_Date) || undefined }
    }))
}

async function pipedrive(domain: string, raw: string) {
    const credential = credentialJson(raw, 'Pipedrive')
    const companyDomain = text(credential.companyDomain, 200).toLowerCase()
    if (!/^[a-z0-9-]+$/.test(companyDomain)) throw new Error('Pipedrive companyDomain must be the account subdomain only.')
    const token = text(credential.apiToken, 4_096)
    if (!token) throw new Error('Pipedrive apiToken is required.')
    const base = `https://${companyDomain}.pipedrive.com`
    const data = await providerJson(`${base}/api/v2/organizations/search?term=${encodeURIComponent(domain)}&fields=custom_fields&limit=10&api_token=${encodeURIComponent(token)}`, {}, 'Pipedrive')
    const items = Array.isArray(object(data.data).items) ? object(data.data).items as unknown[] : []
    const organization = object(object(items[0]).item)
    if (!text(organization.id, 100)) return none('pipedrive')
    return exact('pipedrive', domain, {
        id: text(organization.id), name: text(organization.name) || domain,
        city: text(object(organization.address).locality) || undefined,
        state: text(object(organization.address).admin_area_level_1) || undefined,
        country: text(object(organization.address).country) || undefined,
        owner: text(object(organization.owner).name) || undefined,
        sourceUrl: `${base}/organization/${text(organization.id)}`,
    })
}

async function dynamics(domain: string, raw: string) {
    const credential = credentialJson(raw, 'Dynamics 365')
    const base = trustedBase(credential.baseUrl, 'Dynamics 365', ['.dynamics.com'])
    const token = text(credential.accessToken, 4_096)
    if (!token) throw new Error('Dynamics 365 accessToken is required.')
    const headers = { authorization: `Bearer ${token}`, accept: 'application/json' }
    const filter = encodeURIComponent(`websiteurl eq '${domain.replace(/'/g, "''")}' or websiteurl eq 'https://${domain}' or websiteurl eq 'http://${domain}'`)
    const data = await providerJson(`${base}/api/data/v9.2/accounts?$select=accountid,name,websiteurl,industrycodename,address1_city,address1_stateorprovince,address1_country&$filter=${filter}&$top=2`, { headers }, 'Dynamics 365')
    const account = object((Array.isArray(data.value) ? data.value : [])[0])
    if (!text(account.accountid, 100)) return none('dynamics')
    return exact('dynamics', domain, {
        id: text(account.accountid), name: text(account.name) || domain,
        industry: text(account.industrycodename) || undefined, city: text(account.address1_city) || undefined,
        state: text(account.address1_stateorprovince) || undefined, country: text(account.address1_country) || undefined,
    })
}

const runners: Record<string, (domain: string, credential: string) => Promise<CrmAccountContext>> = {
    hubspot: resolveHubSpotDomain,
    salesforce,
    pipedrive,
    close: closeCrm,
    zoho,
    dynamics,
    attio,
}

export async function resolveConnectedCrm(domain: string) {
    const connected = listIntegrationSummaries().filter((item) => item.category === 'crm' && item.available && item.status === 'connected')
    if (!connected.length) return { ...none('local'), disconnected: true }
    let lastNone = none(connected[0].id)
    let successfulLookup = false
    let lastError: unknown
    for (const provider of connected) {
        const credential = getCredential(provider.id)
        if (!credential) continue
        try {
            const result = await runners[provider.id](domain, credential)
            successfulLookup = true
            if (result.match === 'exact-domain') return result
            lastNone = result
        } catch (error) {
            lastError = error
        }
    }
    if (!successfulLookup && lastError) throw lastError
    return lastNone
}
