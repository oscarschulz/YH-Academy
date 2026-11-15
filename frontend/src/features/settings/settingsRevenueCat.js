import { apiFetch } from '../../services/api/apiClient'

function normalizeVerifiedBadgeDivision(division = 'academy') {
  return String(division || '').trim().toLowerCase() === 'federation'
    ? 'federation'
    : 'academy'
}

function verifiedBadgeCode(division = 'academy') {
  return normalizeVerifiedBadgeDivision(division) === 'federation'
    ? 'YHF'
    : 'YHA'
}

function verifiedBadgeOfferingId(division = 'academy') {
  return normalizeVerifiedBadgeDivision(division) === 'federation'
    ? 'yhf_offering'
    : 'yha_offering'
}

function verifiedBadgeOneTimePackageId(division = 'academy') {
  return normalizeVerifiedBadgeDivision(division) === 'federation'
    ? 'yhf_30day'
    : 'yha_30day'
}

export function academyYhaRevenueCatRuntime() {
  try {
    return window?.YHNativeRuntime?.revenueCat || null
  } catch {
    return null
  }
}

export function academyYhaIsNativeIos() {
  try {
    const runtime =
      window?.YHNativeRuntime

    if (
      !runtime ||
      !runtime.revenueCat
    ) {
      return false
    }

    if (
      typeof runtime.revenueCat.isAvailable === 'function' &&
      runtime.revenueCat.isAvailable() !== true
    ) {
      return false
    }

    if (
      typeof runtime.isIOSApp === 'function'
    ) {
      return runtime.isIOSApp() === true
    }

    if (
      typeof runtime.getPlatform === 'function'
    ) {
      return (
        String(
          runtime.getPlatform() || ''
        )
          .trim()
          .toLowerCase() === 'ios'
      )
    }

    return false
  } catch {
    return false
  }
}

export function academyYhaIsRevenueCatUserCancelled(error = null) {
  return Boolean(
    error?.userCancelled === true ||
    error?.userCanceled === true ||
    error?.userInfo?.userCancelled === true ||
    error?.userInfo?.userCanceled === true ||
    error?.details?.userCancelled === true ||
    error?.details?.userCanceled === true
  )
}

export function academyYhaPackageFromOffering(
  offering,
  billingPlan = 'monthly',
  division = 'academy',
) {
  if (!offering) {
    return null
  }

  const plan =
    String(
      billingPlan || 'monthly'
    )
      .trim()
      .toLowerCase()

  if (plan === 'monthly') {
    return (
      offering.monthly ||
      offering.availablePackages?.find(
        item =>
          item?.identifier ===
          '$rc_monthly'
      ) ||
      null
    )
  }

  if (
    plan === 'one_time' ||
    plan === 'one-time'
  ) {
    const identifier =
      verifiedBadgeOneTimePackageId(
        division
      )

    return (
      offering.availablePackages?.find(
        item =>
          item?.identifier ===
          identifier
      ) ||
      null
    )
  }

  if (plan === 'lifetime') {
    return (
      offering.lifetime ||
      offering.availablePackages?.find(
        item =>
          item?.identifier ===
          '$rc_lifetime'
      ) ||
      null
    )
  }

  return null
}

export async function academyYhaPurchaseWithRevenueCat(
  billingPlan = 'monthly',
  division = 'academy',
) {
  const cleanDivision =
    normalizeVerifiedBadgeDivision(
      division
    )

  const code =
    verifiedBadgeCode(
      cleanDivision
    )

  const revenueCat =
    academyYhaRevenueCatRuntime()

  if (
    !revenueCat ||
    typeof revenueCat.getOfferings !== 'function' ||
    typeof revenueCat.purchasePackage !== 'function'
  ) {
    throw new Error(
      'Apple In-App Purchase is unavailable.'
    )
  }

  const offerings =
    await revenueCat.getOfferings()

  const offering =
    offerings?.all?.[
      verifiedBadgeOfferingId(
        cleanDivision
      )
    ] ||
    null

  if (!offering) {
    throw new Error(
      `${code} App Store offering is unavailable.`
    )
  }

  const packageToBuy =
    academyYhaPackageFromOffering(
      offering,
      billingPlan,
      cleanDivision,
    )

  if (!packageToBuy) {
    throw new Error(
      `This ${code} App Store plan is unavailable right now.`
    )
  }

  await revenueCat.purchasePackage(
    packageToBuy
  )

  const syncResult =
    await apiFetch(
      `/api/payments/badges/${encodeURIComponent(
        cleanDivision
      )}/revenuecat-sync`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    )

  if (
    syncResult?.success !== true ||
    syncResult?.badge?.active !== true
  ) {
    throw new Error(
      `Your App Store purchase was received, but ${code} access could not be verified yet.`,
    )
  }

  return syncResult
}

export async function academyYhaRestoreWithRevenueCat(
  division = 'academy'
) {
  const cleanDivision =
    normalizeVerifiedBadgeDivision(
      division
    )

  const code =
    verifiedBadgeCode(
      cleanDivision
    )

  const revenueCat =
    academyYhaRevenueCatRuntime()

  if (
    !revenueCat ||
    typeof revenueCat.restorePurchases !== 'function'
  ) {
    throw new Error(
      'App Store purchase restoration is unavailable.'
    )
  }

  await revenueCat.restorePurchases()

  const syncResult =
    await apiFetch(
      `/api/payments/badges/${encodeURIComponent(
        cleanDivision
      )}/revenuecat-sync`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    )

  if (
    syncResult?.success !== true ||
    syncResult?.badge?.active !== true
  ) {
    throw new Error(
      `No active ${code} App Store purchase was found to restore.`
    )
  }

  return syncResult
}
