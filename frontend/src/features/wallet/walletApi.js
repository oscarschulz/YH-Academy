
import { apiFetch } from '../../services/api/apiClient'

export function fetchWalletEndpoint(url) {
  return apiFetch(url, { method: 'GET' })
}

export function requestWalletWithdrawal(payload) {
  return apiFetch('/api/payouts/withdrawal-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
