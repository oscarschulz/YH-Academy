import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import AcademyRoadmapBuilder from './AcademyRoadmapBuilder'

const CACHE_KEY =
  'yh_academy_home'

function clean(value = '') {
  return String(
    value ?? '',
  ).trim()
}

function number(
  value,
  fallback = 0,
) {
  const parsed =
    Number(value)

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : fallback
}

function readCache() {
  try {
    const value =
      JSON.parse(
        localStorage.getItem(
          CACHE_KEY,
        ) || 'null',
      )

    return value &&
      typeof value ===
        'object' &&
      !Array.isArray(value)
      ? value
      : null
  } catch {
    return null
  }
}

function writeCache(value) {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return
  }

  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(value),
    )

    window.dispatchEvent(
      new Event('yh-academy-home-updated')
    )
  } catch {}
}

const PROGRESSION_CACHE_KEY =
  'yh_academy_progression_v1'

function readProgressionCache() {
  try {
    const parsed =
      JSON.parse(
        sessionStorage.getItem(
          PROGRESSION_CACHE_KEY,
        ) || 'null',
      )

    const progression =
      parsed?.progression &&
      typeof parsed.progression === 'object'
        ? parsed.progression
        : parsed

    return progression &&
      typeof progression === 'object' &&
      !Array.isArray(progression)
      ? progression
      : null
  } catch {
    return null
  }
}

function writeProgressionCache(
  value,
) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return
  }

  const progression =
    value.progression &&
    typeof value.progression === 'object'
      ? value.progression
      : value

  try {
    sessionStorage.setItem(
      PROGRESSION_CACHE_KEY,
      JSON.stringify({
        progression,
        cachedAt: new Date().toISOString(),
      }),
    )
  } catch {}

  /* YHU_ACADEMY_GAME_CORE_PROGRESSION_BRIDGE */
  let localCoreNotified = false

  try {
    if (
      typeof window.YHUGameCore
        ?.setAcademyProgressionCache === 'function'
    ) {
      localCoreNotified =
        window.YHUGameCore
          .setAcademyProgressionCache(progression) === true
    }
  } catch {}

  if (!localCoreNotified) {
    try {
      window.dispatchEvent(
        new CustomEvent(
          'yhu:academy-progression-updated',
          { detail: progression },
        ),
      )
    } catch {}
  }

  try {
    if (window.parent && window.parent !== window) {
      let parentCoreNotified = false

      try {
        if (
          typeof window.parent.YHUGameCore
            ?.setAcademyProgressionCache === 'function'
        ) {
          parentCoreNotified =
            window.parent.YHUGameCore
              .setAcademyProgressionCache(progression) === true
        }
      } catch {}

      if (!parentCoreNotified) {
        window.parent.postMessage(
          {
            type: 'yhu:academy-progression-updated',
            progression,
          },
          window.location.origin,
        )
      }
    }
  } catch {}
}

/* YHU_ACADEMY_FINAL_CANONICAL_RESULT_BRIDGE */
function publishAcademyResult(
  result = {},
  action = 'academy_verified_action',
) {
  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result)
  ) {
    return
  }

  const progression =
    result.progression &&
    typeof result.progression === 'object'
      ? result.progression
      : null

  if (
    progression &&
    action !== 'academy_quest_reward'
  ) {
    writeProgressionCache(progression)
  }

  const squadMissionProgress =
    result.squadMissionProgress &&
    typeof result.squadMissionProgress === 'object'
      ? result.squadMissionProgress
      : null

  const squadXp =
    result.squadXp &&
    typeof result.squadXp === 'object'
      ? result.squadXp
      : null

  const nestedSquadProgress =
    squadXp?.squadMissionProgress &&
    typeof squadXp.squadMissionProgress === 'object'
      ? squadXp.squadMissionProgress
      : null

  if (squadMissionProgress || nestedSquadProgress) {
    const lead = result.lead || {}

    const detail = {
      type: 'yhu:academy-squad-action-completed',
      version: 'academy-squad-live-sync-v1',
      source: 'academy',
      action,
      leadId: clean(
        lead.id ||
        lead.leadId ||
        lead.sourceDocumentId ||
        lead.source_document_id ||
        lead.data?.id
      ),
      squadMissionProgress,
      squadXp,
      progression,
      occurredAt: new Date().toISOString(),
    }

    try {
      window.dispatchEvent(
        new CustomEvent(
          'yhu:academy-squad-action-completed',
          { detail },
        ),
      )
    } catch {}

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          detail,
          window.location.origin,
        )
      }
    } catch {}
  }

  if (action !== 'academy_quest_reward') {
    return
  }

  const questAchievementState = {
    version:
      result.questPersistence?.version ||
      'academy-quest-achievement-v1',
    serverBacked:
      result.questPersistence?.serverBacked === true,
    persistent:
      result.questPersistence?.persistent === true,
    quests:
      result.quests &&
      typeof result.quests === 'object'
        ? result.quests
        : {},
    achievements:
      result.achievements &&
      typeof result.achievements === 'object'
        ? result.achievements
        : {},
  }

  try {
    window.dispatchEvent(
      new CustomEvent(
        'yhu:academy-quest-state-updated',
        { detail: questAchievementState },
      ),
    )
  } catch {}

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'yhu:academy-quest-state-updated',
          questAchievementState,
        },
        window.location.origin,
      )
    }
  } catch {}

  try {
    document.dispatchEvent(
      new CustomEvent(
        'academy:quest-reward-claimed',
        { detail: result },
      ),
    )
  } catch {}
}

function titleCase(
  value = '',
) {
  const cleanValue =
    clean(value)

  if (!cleanValue) {
    return 'Pending'
  }

  return cleanValue
    .replace(/[_-]+/g, ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    )
}

function getMissionTitle(
  mission = {},
  index = 0,
) {
  return (
    clean(
      mission.title ||
        mission.name ||
        mission.label ||
        mission.missionTitle ||
        mission.mission_title,
    ) ||
    `Mission ${index + 1}`
  )
}

function getMissionCopy(
  mission = {},
) {
  return clean(
    mission.description ||
      mission.summary ||
      mission.instructions ||
      mission.action ||
      mission.task ||
      mission.body,
  )
}

function getMissionStatus(
  mission = {},
) {
  return (
    clean(
      mission.status,
    ).toLowerCase() ||
    'pending'
  )
}

function ProgressBar({
  value = 0,
}) {
  const percent =
    Math.max(
      0,
      Math.min(
        100,
        number(value),
      ),
    )

  return (
    <div className="roadmap-transform-progress-bar">
      <div
        style={{
          width: `${percent}%`,
        }}
      />
    </div>
  )
}

export default function AcademyRoadmapWorkspace({
  onToast,
  onWorkspaceOpen,
}) {
  const [home, setHome] =
    useState(() =>
      readCache(),
    )

  const [loading, setLoading] =
    useState(
      !readCache(),
    )

  const [refreshing, setRefreshing] =
    useState(false)

  const [
    roadmapRefreshing,
    setRoadmapRefreshing,
  ] = useState(false)

  const [error, setError] =
    useState('')

  const [roadmapAccessRequired, setRoadmapAccessRequired] = useState(false)
  const [
    missionAction,
    setMissionAction,
  ] = useState(null)

  const [
    missionActionNote,
    setMissionActionNote,
  ] = useState('')

  const [
    missionActionBusy,
    setMissionActionBusy,
  ] = useState(false)

  const [
    missionJournal,
    setMissionJournal,
  ] = useState(null)

  const [
    missionJournalBusy,
    setMissionJournalBusy,
  ] = useState('')

  const [
    missionJournalVerification,
    setMissionJournalVerification,
  ] = useState(null)

  const [
    checkinDraft,
    setCheckinDraft,
  ] = useState(null)

  const [
    checkinBusy,
    setCheckinBusy,
  ] = useState(false)

  const [
    progression,
    setProgression,
  ] = useState(
    () =>
      readProgressionCache(),
  )

  const [
    champions,
    setChampions,
  ] = useState(null)

  const [
    progressionLoading,
    setProgressionLoading,
  ] = useState(true)

  const [
    questClaimBusy,
    setQuestClaimBusy,
  ] = useState('')

  const [
    roadmapBuilderMode,
    setRoadmapBuilderMode,
  ] = useState('')

  const load =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!silent) {
          setRefreshing(true)
        }

        try {
          const result =
            await apiFetch(
              '/api/academy/home',
              {
                method: 'GET',
              },
            )

          if (
            !result ||
            typeof result !==
              'object'
          ) {
            throw new Error(
              'Academy home returned an invalid response.',
            )
          }

          setRoadmapAccessRequired(false)
          setError('')

          writeCache(
            result,
          )

          setHome(
            result,
          )

          return result
        } catch (loadError) {
          const message =
            loadError?.message ||
            'Failed to load Academy roadmap.'

          if (
            loadError?.status === 403 &&
            /roadmap access not approved/i.test(message)
          ) {
            setRoadmapAccessRequired(true)
            setHome(null)
            setError('')
            return null
          }

          setHome(null)
          setError(message)

          if (!silent && !/academy membership not approved/i.test(String(message || ''))) {
            onToast?.(
              message,
              'error',
            )
          }

          return null
        } finally {
          setLoading(false)
          setRefreshing(false)
        }
      },
      [onToast],
    )

  const loadCanonicalProgression =
    useCallback(
      async () => {
        setProgressionLoading(
          true,
        )

        const [
          progressionResult,
          championsResult,
        ] =
          await Promise.allSettled([
            apiFetch(
              '/api/academy/progression',
              {
                method: 'GET',
                cache: 'no-store',
              },
            ),

            apiFetch(
              '/api/academy/champions',
              {
                method: 'GET',
                cache: 'no-store',
              },
            ),
          ])

        if (
          progressionResult.status ===
          'fulfilled'
        ) {
          const raw =
            progressionResult.value

          const next =
            raw?.progression &&
            typeof raw.progression ===
              'object'
              ? raw.progression
              : raw

          if (
            next &&
            typeof next ===
              'object'
          ) {
            writeProgressionCache(
              next,
            )

            setProgression(
              next,
            )
          }
        }

        if (
          championsResult.status ===
          'fulfilled'
        ) {
          const next =
            championsResult.value

          if (
            next &&
            typeof next ===
              'object'
          ) {
            setChampions(
              next,
            )
          }
        }

        setProgressionLoading(
          false,
        )
      },
      [],
    )

  const claimQuestReward =
    useCallback(
      async (questId) => {
        const id =
          clean(questId)

        if (
          !id ||
          questClaimBusy
        ) {
          return
        }

        setQuestClaimBusy(id)

        try {
          const result =
            await apiFetch(
              `/api/academy/quests/${encodeURIComponent(
                id,
              )}/claim`,
              {
                method: 'POST',
              },
            )

          if (
            result &&
            typeof result ===
              'object'
          ) {
            setChampions(
              result,
            )

            if (
              result?.progression &&
              typeof result.progression ===
                'object'
            ) {
              writeProgressionCache(
                result.progression,
              )

              setProgression(
                result.progression,
              )
            }

            publishAcademyResult(
              result,
              'academy_quest_reward',
            )
          }

          const awarded =
            Math.max(
              0,
              number(
                result?.claim
                  ?.xpAwarded,
                0,
              ),
            )

          onToast?.(
            awarded > 0
              ? `Quest reward claimed • +${awarded} XP`
              : 'Quest reward already claimed.',
            'success',
          )

          await loadCanonicalProgression()
        } catch (
          claimError
        ) {
          onToast?.(
            claimError?.message ||
              'Unable to claim the Academy quest reward.',
            'error',
          )
        } finally {
          setQuestClaimBusy('')
        }
      },
      [
        loadCanonicalProgression,
        onToast,
        questClaimBusy,
      ],
    )

  const handleRoadmapBuilderComplete =
    useCallback(
      async () => {
        setRoadmapBuilderMode('')

        await Promise.all([
          load(),
          loadCanonicalProgression(),
        ])
      },
      [
        load,
        loadCanonicalProgression,
      ],
    )

  const refreshRoadmap =
    useCallback(
      async () => {
        setRoadmapRefreshing(
          true,
        )

        try {
          const result =
            await apiFetch(
              '/api/academy/roadmap/refresh',
              {
                method: 'POST',
                body: JSON.stringify(
                  {},
                ),
              },
            )

          const nextHome =
            result?.home &&
            typeof result.home ===
              'object'
              ? result.home
              : readCache()

          if (nextHome) {
            writeCache(
              nextHome,
            )

            setHome(
              nextHome,
            )
          }

          onToast?.(
            'Roadmap refreshed.',
            'success',
          )

          return nextHome
        } catch (refreshError) {
          const message =
            refreshError?.message ||
            'Roadmap refresh failed.'

          onToast?.(
            message,
            'error',
          )

          return null
        } finally {
          setRoadmapRefreshing(
            false,
          )
        }
      },
      [onToast],
    )

  const mergeMissionIntoHome = (
    missionId,
    patch = {},
  ) => {
    setHome((current) => {
      if (
        !current ||
        typeof current !==
          'object'
      ) {
        return current
      }

      const list =
        Array.isArray(
          current.missions,
        )
          ? current.missions
          : []

      const next = {
        ...current,
        missions:
          list.map(
            (mission) =>
              clean(
                mission?.id,
              ) ===
              clean(
                missionId,
              )
                ? {
                    ...mission,
                    ...patch,
                  }
                : mission,
          ),
      }

      writeCache(next)

      return next
    })
  }

  const buildMissionSignalSnapshot =
    () => {
      const missionList =
        Array.isArray(
          home?.missions,
        )
          ? home.missions
          : []

      return missionList.reduce(
        (
          summary,
          mission,
        ) => {
          const status =
            clean(
              mission?.status ||
                'pending',
            ).toLowerCase() ||
            'pending'

          summary.total += 1

          if (
            status ===
            'completed'
          ) {
            summary.completed += 1
          } else if (
            status ===
            'skipped'
          ) {
            summary.skipped += 1
          } else if (
            status ===
            'stuck'
          ) {
            summary.stuck += 1
          } else {
            summary.pending += 1
          }

          return summary
        },
        {
          total: 0,
          completed: 0,
          skipped: 0,
          stuck: 0,
          pending: 0,
        },
      )
    }

  const openCheckin = () => {
    setCheckinDraft({
      energyScore: '7',
      moodScore: '7',
      disciplineScore: '7',
      completedToday: true,
      avoidanceCategory: '',
      avoidanceNote: '',
      reflectionText: '',
      correctionForTomorrow: '',
      completedSummary: '',
      blockerText: '',
      tomorrowFocus: '',
    })
  }

  const closeCheckin = () => {
    if (checkinBusy) {
      return
    }

    setCheckinDraft(null)
  }

  const submitCheckin =
    async (event) => {
      event?.preventDefault?.()

      if (checkinBusy) {
        return
      }

      const energyScore =
        clean(
          checkinDraft?.energyScore,
        )

      const moodScore =
        clean(
          checkinDraft?.moodScore,
        )

      const disciplineScore =
        clean(
          checkinDraft?.disciplineScore,
        )

      const completedSummary =
        clean(
          checkinDraft?.completedSummary,
        )

      const blockerText =
        clean(
          checkinDraft?.blockerText,
        )

      const tomorrowFocus =
        clean(
          checkinDraft?.tomorrowFocus,
        )

      const avoidanceCategory =
        clean(
          checkinDraft?.avoidanceCategory,
        )

      const avoidanceNote =
        clean(
          checkinDraft?.avoidanceNote,
        )

      const reflectionText =
        clean(
          checkinDraft?.reflectionText,
        )

      const correctionForTomorrow =
        clean(
          checkinDraft
            ?.correctionForTomorrow,
        )

      const completedToday =
        checkinDraft
          ?.completedToday !== false

      if (
        !energyScore ||
        !moodScore ||
        !completedSummary ||
        !tomorrowFocus
      ) {
        onToast?.(
          'Please complete the required check-in fields.',
          'error',
        )

        return
      }

      setCheckinBusy(true)

      try {
        const result =
          await apiFetch(
            '/api/academy/checkin',
            {
              method: 'POST',

              body:
                JSON.stringify({
                  energyScore,
                  moodScore,
                  disciplineScore,
                  completedToday,

                  badHabitAvoided:
                    Boolean(
                      avoidanceCategory ||
                        avoidanceNote,
                    ),

                  avoidanceCategory,
                  avoidanceNote,
                  reflectionText,
                  correctionForTomorrow,
                  completedSummary,
                  blockerText,
                  tomorrowFocus,

                  checkinDate:
                    new Date().toISOString().slice(0, 10),

                  missionSignals:
                    buildMissionSignalSnapshot(),
                }),
            },
          )

        publishAcademyResult(result)

        setHome(
          (current) => {
            if (
              !current ||
              typeof current !==
                'object'
            ) {
              return current
            }

            const next = {
              ...current,
            }

            if (
              result?.behaviorProfile &&
              typeof result.behaviorProfile ===
                'object'
            ) {
              next.previousBehaviorProfile =
                result?.previousBehaviorProfile ||
                current.behaviorProfile ||
                current.previousBehaviorProfile ||
                {}

              next.behaviorProfile =
                result.behaviorProfile
            }

            if (
              result?.plannerStats &&
              typeof result.plannerStats ===
                'object'
            ) {
              next.plannerStats =
                result.plannerStats
            }

            if (
              result?.adaptivePlanning &&
              typeof result.adaptivePlanning ===
                'object'
            ) {
              next.adaptivePlanning =
                result.adaptivePlanning
            }

            if (
              result?.transformationSystem &&
              typeof result.transformationSystem ===
                'object'
            ) {
              next.transformationSystem =
                result.transformationSystem
            }

            if (
              result?.recentCheckins
            ) {
              next.recentCheckins =
                result.recentCheckins
            }

            writeCache(next)

            return next
          },
        )

        await new Promise(
          (resolve) =>
            window.setTimeout(
              resolve,
              520,
            ),
        )

        setCheckinDraft(null)

        await Promise.all([
          load({ silent: true }),
          loadCanonicalProgression(),
        ])

        const awardedXp =
          Math.max(
            0,
            Number(
              result?.xp?.awarded,
            ) || 0,
          )

        onToast?.(
          awardedXp > 0
            ? `Check-in saved • +${awardedXp} XP`
            : 'Check-in saved',
          'success',
        )
      } catch (checkinError) {
        onToast?.(
          checkinError?.message ||
            'Check-in failed.',
          'error',
        )
      } finally {
        setCheckinBusy(false)
      }
    }

  const openMissionJournal = (
    mission,
  ) => {
    const missionId =
      clean(
        mission?.id,
      )

    if (!missionId) {
      onToast?.(
        'Mission data is unavailable.',
        'error',
      )

      return
    }

    setMissionJournal({
      missionId,

      title:
        getMissionTitle(
          mission,
        ),

      mission,

      workingNote:
        clean(
          mission?.workingNote,
        ),

      proofNote:
        clean(
          mission?.proofNote ||
            mission?.completionNote,
        ),

      reflectionNote:
        clean(
          mission?.reflectionNote,
        ),
    })

    setMissionJournalVerification({
      status:
        mission?.verificationStatus ||
        '',

      decision:
        mission?.verificationDecision ||
        '',

      feedback:
        mission?.verificationFeedback ||
        '',

      missingItems:
        Array.isArray(
          mission?.verificationMissingItems,
        )
          ? mission.verificationMissingItems
          : [],

      evidenceSummary:
        mission?.verificationEvidenceSummary ||
        '',
    })
  }

  const closeMissionJournal = () => {
    if (
      missionJournalBusy
    ) {
      return
    }

    setMissionJournal(null)

    setMissionJournalVerification(
      null,
    )
  }

  const getMissionJournalPayload =
    () => ({
      workingNote:
        clean(
          missionJournal?.workingNote,
        ),

      proofNote:
        clean(
          missionJournal?.proofNote,
        ),

      reflectionNote:
        clean(
          missionJournal
            ?.reflectionNote,
        ),
    })

  const saveMissionJournal =
    async () => {
      const missionId =
        clean(
          missionJournal?.missionId,
        )

      const journal =
        getMissionJournalPayload()

      if (!missionId) {
        onToast?.(
          'Mission data is unavailable.',
          'error',
        )

        return false
      }

      if (
        !journal.workingNote &&
        !journal.proofNote &&
        !journal.reflectionNote
      ) {
        onToast?.(
          'Write at least one Mission Journal entry before saving.',
          'error',
        )

        return false
      }

      setMissionJournalBusy(
        'save',
      )

      try {
        const result =
          await apiFetch(
            `/api/academy/missions/${encodeURIComponent(
              missionId,
            )}/journal`,
            {
              method: 'PATCH',

              body:
                JSON.stringify(
                  journal,
                ),
            },
          )

        const verification =
          result?.verification ||
          {}

        const patch = {
          ...journal,

          noteUpdatedAt:
            result?.journal
              ?.noteUpdatedAt ||
            new Date()
              .toISOString(),

          verificationStatus:
            verification.status ||
            'draft',

          verificationDecision:
            verification.decision ||
            '',

          verificationFeedback:
            verification.feedback ||
            '',

          verificationMissingItems:
            Array.isArray(
              verification.missingItems,
            )
              ? verification.missingItems
              : [],
        }

        mergeMissionIntoHome(
          missionId,
          patch,
        )

        setMissionJournal(
          (current) =>
            current
              ? {
                  ...current,
                  ...journal,
                }
              : current,
        )

        setMissionJournalVerification(
          verification,
        )

        onToast?.(
          'Mission Journal saved. No XP was awarded.',
          'success',
        )

        return true
      } catch (saveError) {
        onToast?.(
          saveError?.message ||
            'Mission Journal save failed.',
          'error',
        )

        return false
      } finally {
        setMissionJournalBusy('')
      }
    }

  const submitMissionForReview =
    async () => {
      const missionId =
        clean(
          missionJournal?.missionId,
        )

      const journal =
        getMissionJournalPayload()

      if (!missionId) {
        onToast?.(
          'Mission data is unavailable.',
          'error',
        )

        return false
      }

      if (
        journal.workingNote.length <
        20
      ) {
        onToast?.(
          'Add a more concrete Working Note before AI review.',
          'error',
        )

        return false
      }

      if (
        journal.proofNote.length <
        30
      ) {
        onToast?.(
          'Add a specific Proof / Result before AI review.',
          'error',
        )

        return false
      }

      if (
        journal.reflectionNote
          .length < 20
      ) {
        onToast?.(
          'Add a specific Reflection before AI review.',
          'error',
        )

        return false
      }

      setMissionJournalBusy(
        'review',
      )

      setMissionJournalVerification({
        status:
          'verification_pending',

        decision:
          'verification_pending',

        feedback:
          'The Academy AI is checking the mission objective, result, proof, and reflection.',

        missingItems: [],
      })

      try {
        const result =
          await apiFetch(
            `/api/academy/missions/${encodeURIComponent(
              missionId,
            )}/complete`,
            {
              method: 'POST',

              body:
                JSON.stringify(
                  journal,
                ),
            },
          )

        const verification =
          result?.verification ||
          {}

        setMissionJournalVerification(
          verification,
        )

        mergeMissionIntoHome(
          missionId,
          {
            ...journal,

            status:
              result?.status ||
              'pending',

            verificationStatus:
              verification.status ||
              verification.decision ||
              '',

            verificationDecision:
              verification.decision ||
              '',

            verificationConfidence:
              verification.confidence ||
              0,

            verificationScores:
              verification.scores ||
              {},

            verificationFeedback:
              verification.feedback ||
              '',

            verificationMissingItems:
              Array.isArray(
                verification.missingItems,
              )
                ? verification.missingItems
                : [],

            verificationEvidenceSummary:
              verification.evidenceSummary ||
              '',
          },
        )

        if (
          result?.approved === true
        ) {
          publishAcademyResult(result)

          void Promise.all([
            load({ silent: true }),
            loadCanonicalProgression(),
          ]).catch((refreshError) => {
            console.error(
              'Academy post-review refresh failed:',
              refreshError,
            )
          })

          const awardedXp =
            Math.max(
              0,
              Number(
                result?.xp
                  ?.awarded,
              ) || 0,
            )

          onToast?.(
            awardedXp > 0
              ? `Mission verified and completed • +${awardedXp} XP`
              : 'Mission verified and completed',
            'success',
          )

          setMissionJournal(null)

          setMissionJournalVerification(
            null,
          )

          return true
        }

        const delayed =
          result?.reviewDelayed ===
            true ||
          verification.status ===
            'review_delayed'

        onToast?.(
          delayed
            ? 'Mission Journal saved. AI review is delayed; no XP was awarded.'
            : 'The Academy AI needs a stronger submission. No XP was awarded.',
          delayed
            ? 'info'
            : 'error',
        )

        return false
      } catch (reviewError) {
        onToast?.(
          reviewError?.message ||
            'Academy AI mission review failed.',
          'error',
        )

        return false
      } finally {
        setMissionJournalBusy('')
      }
    }

  const openMissionAction = (
    mission,
    status,
  ) => {
    const missionId =
      clean(
        mission?.id,
      )

    if (!missionId) {
      onToast?.(
        'Mission data is unavailable.',
        'error',
      )

      return
    }

    setMissionAction({
      missionId,
      status,
      title:
        getMissionTitle(
          mission,
        ),
    })

    setMissionActionNote('')
  }

  const closeMissionAction = () => {
    if (missionActionBusy) {
      return
    }

    setMissionAction(null)
    setMissionActionNote('')
  }

  const submitMissionAction =
    async (event) => {
      event?.preventDefault?.()

      const missionId =
        clean(
          missionAction?.missionId,
        )

      const status =
        clean(
          missionAction?.status,
        ).toLowerCase()

      const note =
        clean(
          missionActionNote,
        )

      if (
        !missionId ||
        ![
          'skipped',
          'stuck',
        ].includes(status)
      ) {
        onToast?.(
          'Mission action is missing required data.',
          'error',
        )

        return
      }

      if (!note) {
        onToast?.(
          'Please add a short note before continuing.',
          'error',
        )

        return
      }

      setMissionActionBusy(
        true,
      )

      try {
        await apiFetch(
          `/api/academy/missions/${encodeURIComponent(
            missionId,
          )}/status`,
          {
            method: 'POST',
            body: JSON.stringify({
              status,
              note,
            }),
          },
        )

        await Promise.all([
          load({ silent: true }),
          loadCanonicalProgression(),
        ])

        onToast?.(
          `Mission marked as ${status}.`,
          'success',
        )

        setMissionAction(null)
        setMissionActionNote('')
      } catch (actionError) {
        onToast?.(
          actionError?.message ||
            'Mission update failed.',
          'error',
        )
      } finally {
        setMissionActionBusy(
          false,
        )
      }
    }

  useEffect(() => {
    void load({
      silent: true,
    })
  }, [load])

  useEffect(() => {
    void loadCanonicalProgression()
  }, [
    loadCanonicalProgression,
  ])

  const roadmap =
    home?.roadmap &&
    typeof home.roadmap ===
      'object'
      ? home.roadmap
      : {}

  const summary =
    roadmap?.summary &&
    typeof roadmap.summary ===
      'object'
      ? roadmap.summary
      : {}

  const today =
    home?.today &&
    typeof home.today ===
      'object'
      ? home.today
      : {}

  // Original Academy mission-list fallback order.
  const missions =
    Array.isArray(home?.missions) && home.missions.length
      ? home.missions
      : Array.isArray(home?.todayMissions) && home.todayMissions.length
        ? home.todayMissions
        : Array.isArray(home?.roadmapSteps) && home.roadmapSteps.length
          ? home.roadmapSteps.slice(0, 5)
          : Array.isArray(home?.allMissions)
            ? home.allMissions.slice(0, 5)
            : []

  const focusAreas =
    Array.isArray(
      roadmap?.focusAreas,
    )
      ? roadmap.focusAreas
      : []

  const behavior =
    home?.behaviorProfile &&
    typeof home.behaviorProfile ===
      'object'
      ? home.behaviorProfile
      : {}

  const planner =
    home?.plannerStats &&
    typeof home.plannerStats ===
      'object'
      ? home.plannerStats
      : {}

  const adaptive =
    home?.adaptivePlanning &&
    typeof home.adaptivePlanning ===
      'object'
      ? home.adaptivePlanning
      : {}

  const system =
    home?.system &&
    typeof home.system ===
      'object'
      ? home.system
      : {}

  const canonicalProgression =
    progression &&
    typeof progression ===
      'object'
      ? progression
      : {}

  const soloMode =
    canonicalProgression
      ?.soloMode &&
    typeof canonicalProgression
      .soloMode ===
      'object'
      ? canonicalProgression
          .soloMode
      : {}

  const soloCampaign =
    soloMode?.campaign &&
    typeof soloMode.campaign ===
      'object'
      ? soloMode.campaign
      : {}

  const soloStreak =
    soloMode?.streak &&
    typeof soloMode.streak ===
      'object'
      ? soloMode.streak
      : {}

  const soloAttributes =
    soloMode?.attributes &&
    typeof soloMode.attributes ===
      'object'
      ? soloMode.attributes
      : {}

  const championPlayer =
    champions?.player &&
    typeof champions.player ===
      'object'
      ? champions.player
      : null

  const championLeaderboards =
    champions?.leaderboards &&
    typeof champions
      .leaderboards ===
      'object'
      ? champions.leaderboards
      : {}

  const academyQuests = [
    ...(
      Array.isArray(
        champions?.quests?.daily,
      )
        ? champions.quests.daily
        : []
    ),

    ...(
      Array.isArray(
        champions?.quests?.weekly,
      )
        ? champions.quests.weekly
        : []
    ),
  ]

  const completed =
    useMemo(
      () =>
        missions.filter(
          (mission) =>
            getMissionStatus(
              mission,
            ) ===
            'completed',
        ).length,
      [missions],
    )

  const total =
    number(
      today.missionsTotal,
      missions.length,
    )

  const completedCount =
    number(
      today.missionsCompleted,
      completed,
    )

  const progress =
    total > 0
      ? Math.round(
          (completedCount /
            total) *
            100,
        )
      : 0

  const readiness =
    number(
      roadmap.readinessScore ??
        home?.readinessScore,
      0,
    )

  const streak =
    number(
      today.streakDays ??
        today.streak,
      0,
    )

  const focusArea =
    clean(
      focusAreas[0]?.label ||
        focusAreas[0]?.name ||
        focusAreas[0]?.title ||
        focusAreas[0] ||
        summary.focusArea ||
        summary.primaryFocus,
    ) ||
    'No active focus yet'

  const foundation =
    clean(
      system.foundationDisplayLabel ||
        system?.roadmapDoctrine
          ?.foundationName ||
        roadmap.foundationDisplayLabel ||
        roadmap.foundationName,
    ) ||
    'Foundation Sprint'

  if (
    loading &&
    !home
  ) {
    return (
      <section
        className="yh-dashboard-react-workspace"
        data-yh-dashboard-react-surface="academy-roadmap"
      >
        <div className="yh-dashboard-settings-loading">
          Loading Academy Roadmap...
        </div>
      </section>
    )
  }

  if (roadmapAccessRequired) {
    return (
      <section
        className="yh-dashboard-react-workspace"
        data-yh-dashboard-react-surface="academy-roadmap"
      >
        <div className="academy-roadmap-apply-state-v1">
          <section className="academy-roadmap-apply-card-v1">
            <div className="academy-roadmap-apply-kicker-v1">
              ROADMAP ACCESS
            </div>

            <h3>Build your Academy roadmap</h3>

            <p>
              Your Academy account is active.
              Roadmap access requires a setup application.
            </p>

            <p>
              Complete the intake to build your missions
              and execution plan.
            </p>

            <div className="academy-roadmap-apply-actions-v1">
              <button
                type="button"
                className="academy-roadmap-apply-btn-v1"
                onClick={() => setRoadmapBuilderMode('build')}
              >
                Apply for Roadmap Access →
              </button>
            </div>
          </section>
        </div>

        {roadmapBuilderMode === 'build' && (
          <AcademyRoadmapBuilder
            mode="build"
            onToast={onToast}
            onClose={() => setRoadmapBuilderMode('')}
            onComplete={handleRoadmapBuilderComplete}
          />
        )}
      </section>
    )
  }


  if (error && !home) {
    return (
      <section
        className="yh-dashboard-react-workspace"
        data-yh-dashboard-react-surface="academy-roadmap"
      >
        <div
          className="yh-dashboard-settings-loading is-error"
          role="alert"
        >
          {error}
        </div>

        <div>
          <button
            type="button"
            className="academy-ui-button academy-ui-button--secondary"
            disabled={refreshing}
            aria-busy={refreshing}
            onClick={() => void load()}
          >
            {refreshing ? 'Checking...' : 'Retry'}
          </button>
        </div>
      </section>
    )
  }


  // Original API: pending/restoring and rebuild-needed are not ready roadmaps.
  if (
    home && home.roadmapReady !== true &&
    (home.emptyRoadmap === true || home.roadmapPending === true ||
      home.requiresRoadmapRebuild === true)
  ) {
    const needsRebuild = home.requiresRoadmapRebuild === true ||
      clean(home.roadmapRepair?.reason) === 'missing_personalization_input'

    return (
      <section className="yh-dashboard-react-workspace"
        data-yh-dashboard-react-surface="academy-roadmap"
        data-yh-academy-native-section="roadmap-pending"
        aria-live="polite">
        <div className="roadmap-clean-shell">
          <div className="roadmap-clean-main">
            <h2>
              {needsRebuild
                ? 'Your Roadmap needs a one-time rebuild'
                : 'Preparing your Academy Roadmap'}
            </h2>
            <p>
              {clean(home.message) || (needsRebuild
                ? 'Refresh your Roadmap personalization answers.'
                : 'Your personalized missions are being restored.')}
            </p>
            <button type="button" className="academy-ui-button academy-ui-button--secondary"
              disabled={refreshing}
              onClick={() => { void load() }}>
              {refreshing ? 'Refreshing...' : 'Refresh Roadmap'}
            </button>
            {needsRebuild && (
              <button type="button" className="academy-ui-button academy-ui-button--primary"
                onClick={() => setRoadmapBuilderMode('rebuild')}>
                Rebuild Personalized Roadmap
              </button>
            )}
            {needsRebuild && roadmapBuilderMode === 'rebuild' && (
              <AcademyRoadmapBuilder
                mode="rebuild"
                onToast={onToast}
                onClose={() => setRoadmapBuilderMode('')}
                onComplete={handleRoadmapBuilderComplete}
              />
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className="yh-dashboard-react-workspace yh-dashboard-react-academy-roadmap"
      data-yh-dashboard-react-surface="academy-roadmap"
      data-yh-academy-native-section="roadmap"
    >
      <div
        className="roadmap-transformation-system"
      >
        <div className="roadmap-clean-shell">
          <section className="roadmap-clean-main">
            <div className="academy-roadmap-overview">
              <div>
                <div className="roadmap-transform-eyebrow">
                  Academy Roadmap
                </div>

                <h1>
                  {foundation}
                </h1>

                <p>
                  {clean(
                    summary.description ||
                      summary.summary ||
                      roadmap.description ||
                      roadmap.summaryText,
                  ) ||
                    'Your current execution roadmap inside the Academy.'}
                </p>


              </div>

              <div className="academy-roadmap-actions">
                <button
                  type="button"
                  className="academy-ui-button academy-ui-button--secondary"
                  disabled={
                    roadmapRefreshing
                  }
                  aria-busy={
                    roadmapRefreshing
                      ? 'true'
                      : 'false'
                  }
                  onClick={() =>
                    void refreshRoadmap()
                  }
                >
                  {roadmapRefreshing
                    ? 'Refreshing Roadmap...'
                    : 'Refresh Roadmap'}
                </button>

                <button
                  type="button"
                  className="academy-ui-button academy-ui-button--secondary"
                  onClick={() =>
                    setRoadmapBuilderMode(
                      focusArea ===
                        'No active focus yet'
                        ? 'build'
                        : 'rebuild',
                    )
                  }
                >
                  {focusArea ===
                  'No active focus yet'
                    ? 'Build Roadmap'
                    : 'Rebuild Roadmap'}
                </button>

                {focusArea !==
                  'No active focus yet' && (
                  <button
                    type="button"
                    className="academy-ui-button academy-ui-button--secondary"
                    onClick={() => {
                      const confirmed =
                        window.confirm(
                          'Change Main Focus? Your completed missions, XP, check-ins, and previous Roadmap will stay saved. A new Roadmap cycle will be built around your new focus.',
                        )

                      if (
                        confirmed
                      ) {
                        setRoadmapBuilderMode(
                          'new-cycle',
                        )
                      }
                    }}
                  >
                    Change Main Focus
                  </button>
                )}
              </div>

              <div className="academy-roadmap-metrics">
                  <span>
                    <small>Focus</small>
                    <strong>
                      {focusArea}
                    </strong>
                  </span>

                  <span>
                    <small>Readiness</small>
                    <strong>
                      {readiness}%
                    </strong>
                  </span>

                  <span>
                    <small>Streak</small>
                    <strong>
                      {streak} day
                      {streak === 1
                        ? ''
                        : 's'}
                    </strong>
                  </span>
                </div>
            </div>

            {/* YHU_ACADEMY_ROADMAP_PROFILE_READINESS_HANDOFF */}
            {home?.plazaReadiness &&
              typeof home.plazaReadiness === 'object' && (
              <section className="academy-home-panel academy-home-readiness-panel">
                <div className="academy-home-panel-label">
                  Plazas Readiness
                </div>

                <div className="academy-home-readiness-hero">
                  <div className="academy-home-readiness-score-card academy-home-readiness-score-stack" role="img" aria-label={'Plazas readiness: ' + number(home.plazaReadiness.score, 0) + ' out of 100'}>
                    <div className="academy-home-readiness-score-value">
                      {number(home.plazaReadiness.score, 0)}
                    </div>
                    <div className="academy-home-readiness-score-separator" aria-hidden="true">—</div>
                    <div className="academy-home-readiness-score-copy">
                      100
                    </div>
                  </div>

                  <div className="academy-home-readiness-summary">
                    <div
                      className={
                        'academy-home-readiness-badge ' +
                        (
                          home.plazaReadiness.marketplaceReady === true &&
                          number(home.plazaReadiness.score) >= 75
                            ? 'is-ready'
                            : number(home.plazaReadiness.score) >= 75
                              ? 'is-strong'
                              : number(home.plazaReadiness.score) >= 40
                                ? 'is-building'
                                : 'is-early'
                        )
                      }
                    >
                      {clean(home.plazaReadiness.statusLabel) ||
                        'Still Building'}
                    </div>

                    <p className="academy-home-panel-copy academy-home-readiness-copy">
                      {clean(home.plazaReadiness.nextStep) ||
                        'Complete your Academy profile and missions to strengthen your Plazas readiness.'}
                    </p>

                    <div className="academy-home-readiness-action-row">
                      <button
                        type="button"
                        className="academy-ui-button academy-ui-button--secondary academy-home-readiness-profile-btn"
                        data-academy-dashboard-profile-edit="true"
                        onClick={() => {
                          try {
                            sessionStorage.setItem(
                              'yh_react_academy_profile_edit_once_v1',
                              '1',
                            )
                            sessionStorage.setItem(
                              'yh_react_academy_profile_return_v1',
                              'academy-roadmap',
                            )
                          } catch {}

                          onWorkspaceOpen?.('academy-profile')
                        }}
                      >
                        Update Profile to Improve Plaza Readiness
                      </button>
                    </div>
                  </div>
                </div>

                <div className="academy-home-readiness-grid">
                  {[
                    ['Role track defined', 'roleTrack'],
                    ['Looking-for signals added', 'lookingFor'],
                    ['Can-offer signals added', 'canOffer'],
                    ['Availability set', 'availability'],
                    ['Work mode set', 'workMode'],
                    ['Proof focus defined', 'proofFocus'],
                  ].map(([label, key]) => {
                    const ready =
                      home.plazaReadiness.signals?.[key] === true

                    return (
                      <div
                        key={key}
                        className={
                          'academy-home-readiness-check ' +
                          (ready ? 'is-active' : 'is-pending')
                        }
                      >
                        <span className="academy-home-readiness-check-icon">
                          {ready ? '✓' : '•'}
                        </span>
                        <span>{label}</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            <div className="roadmap-clean-grid">
              <div className="roadmap-transform-card roadmap-today-card">
                <div className="roadmap-transform-eyebrow">
                  Today
                </div>

                <h3>
                  Current execution
                </h3>

                <strong>
                  {completedCount} /{' '}
                  {total} missions
                </strong>

                <ProgressBar
                  value={
                    progress
                  }
                />

                <small>
                  {progress}%
                  complete today
                </small>

                <div className="roadmap-mission-actions">
                  <button
                    type="button"
                    className="academy-ui-button academy-ui-button--secondary"
                    onClick={() =>
                      void openCheckin()
                    }
                  >
                    Daily Check-In
                  </button>
                </div>
              </div>

              <div className="roadmap-transform-card roadmap-compact-progress">
                <div className="roadmap-transform-eyebrow">
                  Execution Profile
                </div>

                <div className="roadmap-transform-stat-list">
                  <div>
                    <span>
                      Reliability
                    </span>

                    <strong>
                      {Math.round(
                        number(
                          behavior.executionReliability,
                          0,
                        ) *
                          100,
                      )}
                      %
                    </strong>
                  </div>

                  <div>
                    <span>
                      Sustainable Load
                    </span>

                    <strong>
                      {number(
                        behavior.maxSustainableDailyMinutes,
                        0,
                      )}{' '}
                      min
                    </strong>
                  </div>

                  <div>
                    <span>
                      Best Window
                    </span>

                    <strong>
                      {clean(
                        behavior.bestExecutionWindow,
                      ) ||
                        'Not set'}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Accountability
                    </span>

                    <strong>
                      {titleCase(
                        behavior.accountabilityNeed ||
                          'not set',
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="roadmap-clean-grid academy-roadmap-progression-row">
              <div className="academy-roadmap-quest-column">
                <section className="roadmap-transform-card academy-quest-league-card">
                  <div className="roadmap-transform-eyebrow">
                    Academy Quest League
                  </div>

                  {progressionLoading &&
                  !championPlayer ? (
                    <div className="academy-profile-empty-state">
                      Loading canonical Academy progression...
                    </div>
                  ) : !championPlayer ? (
                    <div className="academy-profile-empty-state">
                      Canonical Academy progression is temporarily unavailable.
                    </div>
                  ) : (
                    <>
                      <h3 className="academy-quest-league-rank">
                        Level{' '}
                        {number(
                          championPlayer.level,
                          1,
                        )}{' '}
                        ·{' '}
                        {clean(
                          championPlayer.rank,
                        ) ||
                          'Initiate'}
                      </h3>

                      <div className="roadmap-journey-strip academy-quest-league-stats">
                        <span>
                          XP
                          <strong>
                            {number(
                              championPlayer.xp,
                              0,
                            )}
                          </strong>
                        </span>

                        <span>
                          Next Rank
                          <strong>
                            {clean(
                              championPlayer.nextRank,
                            ) ||
                              'Builder'}
                          </strong>
                        </span>

                        <span>
                          Weekly XP
                          <strong>
                            {number(
                              championPlayer.weeklyXp,
                              0,
                            )}
                          </strong>
                        </span>
                      </div>

                      <div className="academy-quest-league-progress">
                        <ProgressBar
                          value={
                            number(
                              championPlayer.rankProgress,
                              0,
                            )
                          }
                        />

                        <small>
                          {Math.max(
                            0,
                            Math.min(
                              100,
                              number(
                                championPlayer.rankProgress,
                                0,
                              ),
                            ),
                          )}
                          % rank progress
                        </small>
                      </div>

                      <div className="roadmap-transform-stat-list academy-quest-league-details">
                        <div>
                          <span>
                            Missions
                          </span>

                          <strong>
                            {number(
                              championPlayer.completedMissions,
                              0,
                            )}
                            /
                            {number(
                              championPlayer.totalMissions,
                              0,
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Streak
                          </span>

                          <strong>
                            {number(
                              championPlayer.streakDays,
                              0,
                            )}{' '}
                            days
                          </strong>
                        </div>

                        <div>
                          <span>
                            Helper Score
                          </span>

                          <strong>
                            {number(
                              championPlayer.helperScore,
                              0,
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Achievement
                          </span>

                          <strong>
                            {clean(
                              championPlayer.badge,
                            ) ||
                              'No achievement unlocked'}
                          </strong>
                        </div>
                      </div>
                    </>
                  )}
                </section>

              {academyQuests.length > 0 && (
                <section className="roadmap-transform-card roadmap-mission-board">
                  <div className="roadmap-mission-board-head">
                    <div>
                      <div className="roadmap-transform-eyebrow">
                        Persistent Quest Ledger
                      </div>

                      <h3>
                        Daily & Weekly Quests
                      </h3>
                    </div>

                    <strong>
                      {number(
                        champions?.quests
                          ?.completedUnclaimed,
                        0,
                      )}{' '}
                      ready
                    </strong>
                  </div>

                  <div className="roadmap-mission-track">
                    {academyQuests.map(
                      (
                        quest,
                        index,
                      ) => {
                        const id =
                          clean(
                            quest.id ||
                              quest.questId,
                          )

                        const status =
                          clean(
                            quest.status ||
                              'in_progress',
                          ).toLowerCase()

                        const progressValue =
                          number(
                            quest.progress,
                            0,
                          )

                        const target =
                          Math.max(
                            1,
                            number(
                              quest.target,
                              1,
                            ),
                          )

                        const reward =
                          Math.max(
                            0,
                            number(
                              quest.rewardXp ??
                                quest.xp,
                              0,
                            ),
                          )

                        return (
                          <article
                            key={
                              id ||
                              index
                            }
                            className="roadmap-mission-day-card"
                            data-academy-quest-id={
                              id
                            }
                          >
                            <span className="roadmap-mission-day-number">
                              {clean(
                                quest.cadence,
                              ).toUpperCase() ||
                                'DAILY'}
                            </span>

                            <strong>
                              {clean(
                                quest.title,
                              ) ||
                                'Academy Quest'}
                            </strong>

                            <span>
                              {progressValue}
                              /
                              {target}
                              {' · '}
                              +{reward} XP
                            </span>

                            {status ===
                            'completed_unclaimed' ? (
                              <div className="roadmap-mission-actions">
                                <button
                                  type="button"
                                  className="academy-ui-button academy-ui-button--primary"
                                  disabled={
                                    questClaimBusy ===
                                    id
                                  }
                                  aria-busy={
                                    questClaimBusy ===
                                    id
                                      ? 'true'
                                      : 'false'
                                  }
                                  onClick={() =>
                                    void claimQuestReward(
                                      id,
                                    )
                                  }
                                >
                                  {questClaimBusy ===
                                  id
                                    ? 'Claiming...'
                                    : `Claim +${reward} XP`}
                                </button>
                              </div>
                            ) : (
                              <small>
                                {status ===
                                'claimed'
                                  ? 'Claimed'
                                  : status ===
                                      'expired'
                                    ? 'Expired'
                                    : 'In Progress'}
                              </small>
                            )}
                          </article>
                        )
                      },
                    )}
                  </div>
                </section>
              )}
              </div>

              <section className="roadmap-transform-card">
                <div className="roadmap-transform-eyebrow">
                  Solo Campaign
                </div>

                {Object.keys(
                  soloMode,
                ).length ? (
                  <>
                    <h3>
                      {clean(
                        soloCampaign.goal,
                      ) ||
                        'Academy Growth Campaign'}
                    </h3>

                    <strong>
                      {number(
                        soloCampaign.completed,
                        0,
                      )}{' '}
                      /{' '}
                      {number(
                        soloCampaign.total,
                        0,
                      )}
                    </strong>

                    <ProgressBar
                      value={
                        number(
                          soloCampaign.percentage,
                          0,
                        )
                      }
                    />

                    <div className="roadmap-transform-stat-list">
                      <div>
                        <span>
                          Growth Points
                        </span>

                        <strong>
                          {number(
                            soloMode.totalGrowthPoints,
                            0,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Verified Missions
                        </span>

                        <strong>
                          {number(
                            soloMode.verifiedMissionCount,
                            0,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Current Streak
                        </span>

                        <strong>
                          {number(
                            soloStreak.current,
                            0,
                          )}{' '}
                          days
                        </strong>
                      </div>

                      <div>
                        <span>
                          Longest Streak
                        </span>

                        <strong>
                          {number(
                            soloStreak.longest,
                            0,
                          )}{' '}
                          days
                        </strong>
                      </div>
                    </div>

                    {Object.keys(
                      soloAttributes,
                    ).length > 0 && (
                      <div className="roadmap-transform-stat-list">
                        {Object.entries(
                          soloAttributes,
                        ).map(
                          ([
                            key,
                            value,
                          ]) => (
                            <div
                              key={
                                key
                              }
                            >
                              <span>
                                {titleCase(
                                  key,
                                )}
                              </span>

                              <strong>
                                {number(
                                  value,
                                  0,
                                )}
                              </strong>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="academy-profile-empty-state">
                    Solo Campaign progression will appear after verified Academy activity.
                  </div>
                )}
              </section>
            </div>

            {championPlayer && (
              <section className="roadmap-transform-card academy-champions-panel">
                <div className="roadmap-transform-eyebrow">
                  Champions
                </div>

                <h3>
                  Academy Leaderboards
                </h3>

                <div className="academy-champions-grid">
                  {[
                    [
                      'Top Builders',
                      championLeaderboards
                        .topBuilders,
                    ],
                    [
                      'Most Consistent',
                      championLeaderboards
                        .mostConsistent,
                    ],
                    [
                      'Top Helpers',
                      championLeaderboards
                        .topHelpers,
                    ],
                  ].map(
                    ([
                      label,
                      entries,
                    ]) => (
                      <div
                        className="academy-champions-board"
                        key={
                          label
                        }
                      >
                        <h4 className="academy-champions-heading">
                          {label}
                        </h4>

                        {(
                          Array.isArray(
                            entries,
                          )
                            ? entries.slice(
                                0,
                                3,
                              )
                            : []
                        ).map(
                          (
                            entry,
                            index,
                          ) => (
                            <div
                              className="academy-champions-entry"
                              key={
                                entry?.id ||
                                entry?.userId ||
                                index
                              }
                            >
                              <span className="academy-champions-position">
                                #{number(entry?.position, index + 1)}
                              </span>
                              <span className="academy-champions-member">
                                {clean(entry?.name) || 'Academy Member'}
                              </span>

                              <strong className="academy-champions-score">
                                {number(
                                  entry?.weeklyXp ??
                                    entry?.xp ??
                                    entry?.weeklyHelperScore ??
                                    entry?.helperScore,
                                  0,
                                )}
                              </strong>
                            </div>
                          ),
                        )}

                        {!Array.isArray(
                          entries,
                        ) ||
                        !entries.length ? (
                          <small className="academy-champions-empty">
                            No ranking data yet.
                          </small>
                        ) : null}
                      </div>
                    ),
                  )}
                </div>
              </section>
            )}

            <section
              className="roadmap-transform-card roadmap-mission-board"
              id="roadmap-transform-progress-card"
            >
              <div className="roadmap-mission-board-head">
                <div>
                  <div className="roadmap-transform-eyebrow">
                    Mission Board
                  </div>

                  <h3>
                    Current missions
                  </h3>
                </div>

                <strong>
                  {completedCount}/
                  {total}
                </strong>
              </div>

              <div className="roadmap-mission-track">
                {!missions.length ? (
                  <div className="academy-profile-empty-state">
                    No active roadmap missions yet.
                  </div>
                ) : (
                  missions.map(
                    (
                      mission,
                      index,
                    ) => {
                      const status =
                        getMissionStatus(
                          mission,
                        )

                      return (
                        <article
                          key={
                            clean(
                              mission.id,
                            ) ||
                            index
                          }
                          className={`roadmap-mission-day-card is-${status}`}
                          data-roadmap-mission-id={
                            clean(
                              mission.id,
                            )
                          }
                        >
                          <span className="roadmap-mission-day-number">
                            Sprint{' '}
                            {String(
                              index +
                                1,
                            ).padStart(
                              2,
                              '0',
                            )}
                          </span>

                          <strong>
                            {getMissionTitle(
                              mission,
                              index,
                            )}
                          </strong>

                          {getMissionCopy(
                            mission,
                          ) && (
                            <p>
                              {getMissionCopy(
                                mission,
                              )}
                            </p>
                          )}

                          <span>
                            {titleCase(
                              status,
                            )}
                          </span>

                          {clean(
                            mission.id,
                          ) &&
                            status !==
                              'completed' && (
                              <div className="roadmap-mission-actions">
                                <button
                                  type="button"
                                  className="academy-ui-button academy-ui-button--primary"
                                  onClick={() =>
                                    openMissionJournal(
                                      mission,
                                    )
                                  }
                                >
                                  Open Mission Note
                                </button>

                                <button
                                  type="button"
                                  className="academy-ui-button academy-ui-button--secondary"
                                  onClick={() =>
                                    openMissionAction(
                                      mission,
                                      'skipped',
                                    )
                                  }
                                >
                                  Skip
                                </button>

                                <button
                                  type="button"
                                  className="academy-ui-button academy-ui-button--secondary"
                                  onClick={() =>
                                    openMissionAction(
                                      mission,
                                      'stuck',
                                    )
                                  }
                                >
                                  Stuck
                                </button>
                              </div>
                            )}
                        </article>
                      )
                    },
                  )
                )}
              </div>
            </section>

            <div className="roadmap-clean-grid">
              <div className="roadmap-transform-card">
                <div className="roadmap-transform-eyebrow">
                  Planner
                </div>

                <h3>
                  Planning signals
                </h3>

                <div className="roadmap-transform-stat-list">
                  <div>
                    <span>
                      Completion Rate
                    </span>

                    <strong>
                      {Math.round(
                        number(
                          planner.completionRate,
                          progress /
                            100,
                        ) *
                          100,
                      )}
                      %
                    </strong>
                  </div>

                  <div>
                    <span>
                      Preferred Mission
                    </span>

                    <strong>
                      {titleCase(
                        behavior
                          .preferredMissionTypes?.[0] ||
                          'Not set',
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="roadmap-transform-card">
                <div className="roadmap-transform-eyebrow">
                  Adaptive Planning
                </div>

                <h3>
                  Current adjustment
                </h3>

                <p>
                  {clean(
                    adaptive.reason ||
                      adaptive.summary ||
                      adaptive.message ||
                      adaptive.recommendation,
                  ) ||
                    'No adaptive adjustment is active right now.'}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
      {roadmapBuilderMode && (
        <AcademyRoadmapBuilder
          mode={
            roadmapBuilderMode
          }
          onToast={onToast}
          onClose={() =>
            setRoadmapBuilderMode(
              '',
            )
          }
          onComplete={
            handleRoadmapBuilderComplete
          }
        />
      )}

      {checkinDraft && (
        <div
          className="modal-overlay"
          data-yh-academy-checkin-modal
          role="dialog"
          aria-modal="true"
          aria-label="Daily Check-In"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCheckin()
            }
          }}
        >
          <form
            className="modal-content academy-checkin-form"
            onSubmit={
              submitCheckin
            }
          >
            <div>
              <h2>
                Daily Check-In
              </h2>

              <p>
                Give the Academy an honest snapshot of today so your roadmap can adapt.
              </p>
            </div>

            <div className="roadmap-clean-grid">
              <label>
                Energy
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="1"
                  required
                  value={
                    checkinDraft.energyScore
                  }
                  disabled={
                    checkinBusy
                  }
                  onChange={(event) =>
                    setCheckinDraft(
                      (current) => ({
                        ...current,
                        energyScore:
                          event.target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                Mood
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="1"
                  required
                  value={
                    checkinDraft.moodScore
                  }
                  disabled={
                    checkinBusy
                  }
                  onChange={(event) =>
                    setCheckinDraft(
                      (current) => ({
                        ...current,
                        moodScore:
                          event.target
                            .value,
                      }),
                    )
                  }
                />
              </label>
            </div>

            <label>
              What did you complete today?
              <textarea
                required
                value={
                  checkinDraft
                    .completedSummary
                }
                disabled={
                  checkinBusy
                }
                placeholder="Finished a task, stuck to plan, trained, shipped work."
                onChange={(event) =>
                  setCheckinDraft(
                    (current) => ({
                      ...current,
                      completedSummary:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <label>
              What blocked you?
              <textarea
                value={
                  checkinDraft
                    .blockerText
                }
                disabled={
                  checkinBusy
                }
                placeholder="Distractions, late sleep, unclear plan, low energy."
                onChange={(event) =>
                  setCheckinDraft(
                    (current) => ({
                      ...current,
                      blockerText:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <div className="roadmap-clean-grid">
              <label>
                Completed your main work today?
                <select
                  value={
                    checkinDraft
                      .completedToday
                      ? 'true'
                      : 'false'
                  }
                  disabled={
                    checkinBusy
                  }
                  onChange={(event) =>
                    setCheckinDraft(
                      (current) => ({
                        ...current,
                        completedToday:
                          event.target
                            .value ===
                          'true',
                      }),
                    )
                  }
                >
                  <option value="true">
                    Yes
                  </option>

                  <option value="false">
                    No
                  </option>
                </select>
              </label>

              <label>
                Discipline
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="1"
                  value={
                    checkinDraft
                      .disciplineScore
                  }
                  disabled={
                    checkinBusy
                  }
                  onChange={(event) =>
                    setCheckinDraft(
                      (current) => ({
                        ...current,
                        disciplineScore:
                          event.target
                            .value,
                      }),
                    )
                  }
                />
              </label>
            </div>

            <label>
              Avoidance category
              <input
                type="text"
                value={
                  checkinDraft
                    .avoidanceCategory
                }
                disabled={
                  checkinBusy
                }
                placeholder="Optional"
                onChange={(event) =>
                  setCheckinDraft(
                    (current) => ({
                      ...current,
                      avoidanceCategory:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <label>
              What did you say no to?
              <input
                type="text"
                value={
                  checkinDraft
                    .avoidanceNote
                }
                disabled={
                  checkinBusy
                }
                placeholder="e.g. I avoided scrolling before work."
                onChange={(event) =>
                  setCheckinDraft(
                    (current) => ({
                      ...current,
                      avoidanceNote:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <label>
              Reflection
              <textarea
                value={
                  checkinDraft
                    .reflectionText
                }
                disabled={
                  checkinBusy
                }
                placeholder="What small action did you take today that your future self will respect?"
                onChange={(event) =>
                  setCheckinDraft(
                    (current) => ({
                      ...current,
                      reflectionText:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <label>
              Correction for tomorrow
              <textarea
                value={
                  checkinDraft
                    .correctionForTomorrow
                }
                disabled={
                  checkinBusy
                }
                placeholder="Keep it simple. One honest correction is enough."
                onChange={(event) =>
                  setCheckinDraft(
                    (current) => ({
                      ...current,
                      correctionForTomorrow:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <label>
              Tomorrow focus
              <textarea
                required
                value={
                  checkinDraft
                    .tomorrowFocus
                }
                disabled={
                  checkinBusy
                }
                placeholder="What is the one thing you want to push next?"
                onChange={(event) =>
                  setCheckinDraft(
                    (current) => ({
                      ...current,
                      tomorrowFocus:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <div className="roadmap-mission-actions">
              <button
                type="button"
                className="academy-ui-button academy-ui-button--secondary"
                disabled={
                  checkinBusy
                }
                onClick={
                  closeCheckin
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="academy-ui-button academy-ui-button--primary"
                disabled={
                  checkinBusy
                }
                aria-busy={
                  checkinBusy
                    ? 'true'
                    : 'false'
                }
              >
                {checkinBusy
                  ? 'Saving Check-In...'
                  : 'Save Check-In'}
              </button>
            </div>
          </form>
        </div>
      )}

      {missionJournal && (
        <div
          className="modal-overlay"
          data-yh-academy-mission-journal-modal
          role="dialog"
          aria-modal="true"
          aria-label="Mission Journal"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeMissionJournal()
            }
          }}
        >
          <div className="modal-content">
            <div>
              <h2>
                {missionJournal.title ||
                  'Mission Note'}
              </h2>

              <p>
                {clean(
                  missionJournal
                    ?.mission
                    ?.missionObjective ||
                    missionJournal
                      ?.mission
                      ?.description,
                ) ||
                  'Record what you did, the result you produced, and what you learned.'}
              </p>
            </div>

            {missionJournalVerification &&
              (
                clean(
                  missionJournalVerification
                    .status,
                ) ||
                clean(
                  missionJournalVerification
                    .decision,
                ) ||
                clean(
                  missionJournalVerification
                    .feedback,
                ) ||
                (
                  Array.isArray(
                    missionJournalVerification
                      .missingItems,
                  ) &&
                  missionJournalVerification
                    .missingItems
                    .length > 0
                )
              ) && (
                <div
                  className="roadmap-transform-card"
                  data-yh-mission-verification={
                    clean(
                      missionJournalVerification
                        .decision ||
                        missionJournalVerification
                          .status,
                    ) ||
                    'review'
                  }
                >
                  <strong>
                    {clean(
                      missionJournalVerification
                        .decision ||
                        missionJournalVerification
                          .status,
                    ) ===
                    'approved'
                      ? 'Academy AI Review: Approved'
                      : clean(
                            missionJournalVerification
                              .decision ||
                              missionJournalVerification
                                .status,
                          ) ===
                          'verification_pending'
                        ? 'Academy AI Review: Checking'
                        : 'Academy AI Review'}
                  </strong>

                  {clean(
                    missionJournalVerification
                      .feedback,
                  ) && (
                    <p>
                      {
                        missionJournalVerification
                          .feedback
                      }
                    </p>
                  )}

                  {Array.isArray(
                    missionJournalVerification
                      .missingItems,
                  ) &&
                    missionJournalVerification
                      .missingItems
                      .length > 0 && (
                      <ul>
                        {missionJournalVerification
                          .missingItems
                          .map(
                            (
                              item,
                              index,
                            ) => (
                              <li
                                key={
                                  `${item}-${index}`
                                }
                              >
                                {String(
                                  item,
                                )}
                              </li>
                            ),
                          )}
                      </ul>
                    )}

                  {clean(
                    missionJournalVerification
                      .evidenceSummary,
                  ) && (
                    <small>
                      {
                        missionJournalVerification
                          .evidenceSummary
                      }
                    </small>
                  )}
                </div>
              )}

            <label>
              Working Note
            </label>

            <textarea
              value={
                missionJournal
                  .workingNote
              }
              disabled={
                Boolean(
                  missionJournalBusy,
                )
              }
              onChange={(event) =>
                setMissionJournal(
                  (current) => ({
                    ...current,
                    workingNote:
                      event.target
                        .value,
                  }),
                )
              }
              placeholder="Describe what you actually worked on."
            />

            <label>
              Proof / Result
            </label>

            <textarea
              value={
                missionJournal
                  .proofNote
              }
              disabled={
                Boolean(
                  missionJournalBusy,
                )
              }
              onChange={(event) =>
                setMissionJournal(
                  (current) => ({
                    ...current,
                    proofNote:
                      event.target
                        .value,
                  }),
                )
              }
              placeholder="Describe the result or proof you produced."
            />

            <small>
              {clean(
                missionJournal
                  ?.mission
                  ?.proofOfCompletion ||
                  missionJournal
                    ?.mission
                    ?.doneLooksLike,
              )
                ? `Required proof: ${clean(
                    missionJournal
                      ?.mission
                      ?.proofOfCompletion ||
                      missionJournal
                        ?.mission
                        ?.doneLooksLike,
                  )}`
                : 'The Academy AI checks this against the mission’s proof requirement.'}
            </small>

            <label>
              Reflection
            </label>

            <textarea
              value={
                missionJournal
                  .reflectionNote
              }
              disabled={
                Boolean(
                  missionJournalBusy,
                )
              }
              onChange={(event) =>
                setMissionJournal(
                  (current) => ({
                    ...current,
                    reflectionNote:
                      event.target
                        .value,
                  }),
                )
              }
              placeholder="Write the lesson, friction point, or correction."
            />

            <small>
              {clean(
                missionJournal
                  ?.mission
                  ?.reflectionPrompt,
              )
                ? `Reflection prompt: ${clean(
                    missionJournal
                      ?.mission
                      ?.reflectionPrompt,
                  )}`
                : 'Answer with a specific lesson, friction point, or correction.'}
            </small>

            <div className="roadmap-mission-actions">
              <button
                type="button"
                className="academy-ui-button academy-ui-button--secondary"
                disabled={
                  Boolean(
                    missionJournalBusy,
                  )
                }
                onClick={
                  closeMissionJournal
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="academy-ui-button academy-ui-button--secondary"
                disabled={
                  Boolean(
                    missionJournalBusy,
                  )
                }
                aria-busy={
                  missionJournalBusy ===
                  'save'
                    ? 'true'
                    : 'false'
                }
                onClick={() =>
                  void saveMissionJournal()
                }
              >
                {missionJournalBusy ===
                'save'
                  ? 'Saving...'
                  : 'Save Note'}
              </button>

              <button
                type="button"
                className="academy-ui-button academy-ui-button--primary"
                disabled={
                  Boolean(
                    missionJournalBusy,
                  )
                }
                aria-busy={
                  missionJournalBusy ===
                  'review'
                    ? 'true'
                    : 'false'
                }
                onClick={() =>
                  void submitMissionForReview()
                }
              >
                {missionJournalBusy ===
                'review'
                  ? 'Academy AI Reviewing...'
                  : 'Submit for AI Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {missionAction && (
        <div
          className="modal-overlay"
          data-yh-academy-mission-action-modal
          role="dialog"
          aria-modal="true"
          aria-label={
            missionAction.status ===
            'skipped'
              ? 'Skip Mission'
              : 'Mark Mission as Stuck'
          }
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeMissionAction()
            }
          }}
        >
          <form
            className="modal-content"
            onSubmit={
              submitMissionAction
            }
          >
            <h2>
              {missionAction.status ===
              'skipped'
                ? 'Skip Mission'
                : 'Mark as Stuck'}
            </h2>

            <p>
              {missionAction.status ===
              'skipped'
                ? `Add a short reason for why you are skipping "${missionAction.title}".`
                : `Add a short reason for why you are stuck on "${missionAction.title}".`}
            </p>

            <label>
              {missionAction.status ===
              'skipped'
                ? 'Why are you skipping it?'
                : 'What is blocking you?'}
            </label>

            <textarea
              value={
                missionActionNote
              }
              disabled={
                missionActionBusy
              }
              onChange={(event) =>
                setMissionActionNote(
                  event.target.value,
                )
              }
              placeholder={
                missionAction.status ===
                'skipped'
                  ? 'Example: This is not aligned with todays priority, or I need to move it to tomorrow.'
                  : 'Example: I am missing clarity, time, energy, or the next step.'
              }
            />

            <div className="roadmap-mission-actions">
              <button
                type="button"
                className="academy-ui-button academy-ui-button--secondary"
                disabled={
                  missionActionBusy
                }
                onClick={
                  closeMissionAction
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="academy-ui-button academy-ui-button--primary"
                disabled={
                  missionActionBusy
                }
                aria-busy={
                  missionActionBusy
                    ? 'true'
                    : 'false'
                }
              >
                {missionActionBusy
                  ? missionAction.status ===
                    'skipped'
                    ? 'Skipping...'
                    : 'Marking as Stuck...'
                  : missionAction.status ===
                      'skipped'
                    ? 'Skip Mission'
                    : 'Mark as Stuck'}
              </button>
            </div>
          </form>
        </div>
      )}

    </section>
  )
}
