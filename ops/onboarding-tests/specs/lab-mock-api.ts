import type { Page } from '@playwright/test'

type UserKey = 'lab' | 'doctor' | 'outsider'

const users: Record<
  UserKey,
  { email: string; id: string; permissions: string[]; roles: string[] }
> = {
  lab: {
    email: 'lab.e2e@synthetic.test',
    id: 'user-lab',
    roles: ['lab_technician'],
    permissions: [
      'lab_requests:read',
      'lab_requests:create',
      'lab_samples:collect',
      'lab_samples:receive',
      'lab_results:enter',
      'lab_results:verify',
      'lab_results:read',
      'patients:search',
    ],
  },
  doctor: {
    email: 'doctor.e2e@synthetic.test',
    id: 'user-doc',
    roles: ['doctor'],
    permissions: ['lab_requests:read', 'lab_requests:create', 'lab_results:read', 'patients:search'],
  },
  outsider: {
    email: 'other.e2e@synthetic.test',
    id: 'user-other',
    roles: ['doctor'],
    permissions: ['lab_requests:read', 'lab_results:read'],
  },
}

export function syntheticLabStore() {
  const patient = {
    id: 'pat-syn-1',
    patientNo: 'SYN-24001',
    firstName: 'Synthetic',
    lastName: 'Patient',
    dateOfBirth: '1990-01-01',
    gender: 'male',
  }
  const otherPatient = {
    id: 'pat-syn-2',
    patientNo: 'SYN-24002',
    firstName: 'Other',
    lastName: 'Synthetic',
  }
  const request = {
    id: 'req-syn-1',
    requestNo: 'SYN-LAB-1',
    status: 'sample_collected',
    priority: 'routine',
    createdAt: new Date().toISOString(),
    createdBy: users.doctor.id,
    patient,
    items: [
      {
        id: 'item-syn-1',
        status: 'sample_collected',
        orderableTest: {
          id: 'ot-1',
          code: 'CBC-SYN',
          name: 'Synthetic CBC',
          isPanel: true,
          parameters: [
            {
              id: 'p-wbc',
              code: 'WBC',
              name: 'White cells',
              unit: 'x10^9/L',
              resultDataType: 'numeric',
              orderIndex: 1,
              referenceRanges: [{ gender: 'ALL', rangeLow: '4', rangeHigh: '11' }],
            },
            {
              id: 'p-hgb',
              code: 'HGB',
              name: 'Haemoglobin',
              unit: 'g/dL',
              resultDataType: 'numeric',
              orderIndex: 2,
              referenceRanges: [],
            },
          ],
        },
        results: [] as Array<Record<string, unknown>>,
      },
    ],
    samples: [
      {
        id: 'smp-syn-1',
        barcode: 'SYN-SMP-1',
        type: 'blood',
        condition: null as string | null,
        receivedAt: null as string | null,
        rejectionReason: null as string | null,
      },
    ],
    attachments: [] as unknown[],
  }
  const otherRequest = {
    id: 'req-syn-2',
    requestNo: 'SYN-LAB-2',
    status: 'sample_collected',
    priority: 'routine',
    createdAt: new Date().toISOString(),
    createdBy: users.doctor.id,
    patient: otherPatient,
    items: [],
    samples: [{ id: 'smp-syn-2', barcode: 'SYN-SMP-2', type: 'blood' }],
    attachments: [],
  }

  let session: UserKey = 'lab'
  const store = { patient, request, otherRequest, session }

  return {
    store,
    users,
    setSession(key: UserKey) {
      store.session = key
    },
  }
}

export async function installLabMockApi(page: Page, harness = syntheticLabStore()) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace(/^\/api\/v1/, '')
    const method = route.request().method()
    const raw = route.request().postData()
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    const { store, users } = harness
    const user = users[store.session]
    const json = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(data),
      })

    if (path === '/auth/hospitals') {
      return json([{ code: 'jalaram', name: 'Synthetic Lab E2E', address: null, primaryColor: '#0d9488', logoUrl: null, tagline: null }])
    }
    if (path === '/auth/login' && method === 'POST') {
      const email = String(body.email ?? '')
      const key = (Object.keys(users) as UserKey[]).find((k) => users[k].email === email) ?? 'lab'
      harness.setSession(key)
      const selected = users[key]
      return json({
        accessToken: `e2e-${key}`,
        refreshToken: 'e2e-refresh',
        user: {
          id: selected.id,
          firstName: key,
          lastName: 'Synthetic',
          email: selected.email,
          roles: selected.roles,
          permissions: selected.permissions,
        },
      })
    }
    if (path === '/auth/me') {
      return json({
        id: user.id,
        firstName: store.session,
        lastName: 'Synthetic',
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
      })
    }
    if (path === '/auth/refresh' && method === 'POST') {
      return json({ accessToken: `e2e-${store.session}`, refreshToken: 'e2e-refresh' })
    }
    if (path === '/auth/logout') return json({ ok: true })
    if (path === '/admin/settings' || path === '/admin/clinical-catalog') return json({})
    if (path === '/notifications/inbox/summary') return json({ unread: 0 })
    if (path === '/laboratory/results/critical') return json([])
    if (path === '/laboratory/catalog/tests') {
      return json([{ id: 'ot-1', code: 'CBC-SYN', name: 'Synthetic CBC', isPanel: true }])
    }
    if (path === '/radiology/modalities') return json([])
    if (path === '/laboratory/catalog/evaluate' && method === 'POST') {
      const results = (body.results as Array<{ parameterCode: string; value: string }>) ?? []
      const flagged = results.map((row) => {
        if (row.parameterCode === 'HGB') {
          return { parameterCode: 'HGB', flag: 'UNASSESSED', legacyFlag: 'unassessed', referenceRangeLabel: 'Not established' }
        }
        const n = Number(row.value)
        let flag = 'NORMAL'
        let legacy = 'normal'
        if (n < 4) {
          flag = n < 1 ? 'CRITICAL' : 'LOW'
          legacy = n < 1 ? 'critically_low' : 'low'
        }
        if (n > 11) {
          flag = 'HIGH'
          legacy = 'high'
        }
        return { parameterCode: row.parameterCode, flag, legacyFlag: legacy, referenceRangeLabel: '4-11' }
      })
      return json({ derived: [], flagged })
    }
    if (path === '/laboratory/requests' && method === 'GET') {
      return json({ items: [store.request, store.otherRequest] })
    }
    if (path === '/laboratory/requests' && method === 'POST') {
      store.request.status = 'requested'
      return json({ id: store.request.id, requestNo: store.request.requestNo, status: 'requested' })
    }
    if (path === `/laboratory/requests/${store.request.id}` && method === 'GET') return json(store.request)
    if (path === `/laboratory/requests/${store.otherRequest.id}` && method === 'GET') return json(store.otherRequest)
    if (path === `/laboratory/requests/${store.request.id}/samples` && method === 'POST') {
      store.request.status = 'sample_collected'
      return json({
        requestNo: store.request.requestNo,
        patient: store.request.patient,
        samples: store.request.samples,
      })
    }
    if (path === '/laboratory/samples/scan' && method === 'POST') {
      const barcode = String(body.barcode ?? '')
      const expected = body.expectedRequestId as string | undefined
      const sample =
        store.request.samples.find((row) => row.barcode === barcode) ??
        store.otherRequest.samples.find((row) => row.barcode === barcode)
      if (!sample) return json({ message: 'No specimen matches this barcode' }, 404)
      const owner = store.request.samples.includes(sample) ? store.request : store.otherRequest
      if (expected && owner.id !== expected) {
        return json({ message: 'This barcode belongs to a different lab request. The patient was not changed.' }, 400)
      }
      return json({
        requestId: owner.id,
        patientName: `${owner.patient.firstName} ${owner.patient.lastName}`,
        identity: 'specimen',
        barcode,
      })
    }
    if (path === `/laboratory/samples/${store.request.samples[0].id}/receive` && method === 'POST') {
      const condition = String(body.condition ?? '')
      if (condition !== 'adequate' && !String(body.rejectionReason ?? '').trim()) {
        return json({ message: 'A rejection reason is required when the specimen is not adequate.' }, 400)
      }
      store.request.samples[0].condition = condition
      store.request.samples[0].receivedAt = new Date().toISOString()
      store.request.samples[0].rejectionReason =
        condition === 'adequate' ? null : String(body.rejectionReason)
      if (condition === 'adequate') store.request.status = 'processing'
      return json(store.request.samples[0])
    }
    if (path === '/laboratory/results/panel' && method === 'POST') {
      if (store.request.status === 'verified') {
        return json({ message: 'A verified result already exists for this test and cannot be changed.' }, 400)
      }
      const rows = (body.results as Array<{ parameterCode: string; value: string }>) ?? []
      store.request.items[0].results = rows.map((row, index) => ({
        id: `res-${index}`,
        value: row.value,
        flag: row.parameterCode === 'HGB' ? 'unassessed' : Number(row.value) < 4 ? 'low' : 'normal',
        referenceRange: row.parameterCode === 'HGB' ? 'Not established' : '4-11',
        parameter: { id: `p-${row.parameterCode}`, code: row.parameterCode, name: row.parameterCode },
        verifiedAt: null,
      }))
      store.request.status = 'resulted'
      return json({ saved: store.request.items[0].results, derived: [], flagged: [] })
    }
    if (path === `/laboratory/requests/${store.request.id}/verify` && method === 'POST') {
      const required = ['WBC', 'HGB']
      const have = new Set(
        (store.request.items[0].results ?? []).map((row) => (row.parameter as { code?: string })?.code),
      )
      const missing = required.filter((code) => !have.has(code))
      if (missing.length) {
        return json(
          { message: `Structured results are required before verification. Missing: ${missing.join(', ')}. A PDF attachment is not a substitute.` },
          400,
        )
      }
      store.request.status = 'verified'
      for (const row of store.request.items[0].results) row.verifiedAt = new Date().toISOString()
      return json([])
    }
    if (path === `/laboratory/requests/${store.request.id}/cancel` && method === 'POST') {
      if (!user.permissions.includes('lab_requests:cancel')) {
        return json({ message: 'Permission denied' }, 403)
      }
      store.request.status = 'cancelled'
      return json(store.request)
    }
    if (path.endsWith('/amend') && method === 'POST') {
      return json({ message: 'Permission denied' }, 403)
    }
    if (path === `/laboratory/requests/${store.request.id}/report` && method === 'GET') {
      const allowed =
        user.permissions.includes('lab_results:verify') || user.id === store.request.createdBy
      if (!user.permissions.includes('lab_results:read') || !allowed) {
        return json({ message: 'Structured laboratory reports are limited' }, 403)
      }
      return json({
        requestNo: store.request.requestNo,
        status: store.request.status,
        html: `<html><body><h1>Synthetic report ${store.request.requestNo}</h1><p>${store.request.patient.firstName}</p></body></html>`,
      })
    }
    if (path.startsWith('/patients')) {
      return json({ items: [store.patient] })
    }
    return json({ message: `Unmocked ${method} ${path}` }, 404)
  })
  return harness
}
