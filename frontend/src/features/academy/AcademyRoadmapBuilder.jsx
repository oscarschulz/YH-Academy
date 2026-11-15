
import {
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react'
import { createPortal } from 'react-dom'

import { apiFetch } from '../../services/api/apiClient'
import { ROADMAP_SCOPE_CONFIG } from './academyRoadmapScopeConfig'

const PROFILE_KEY =
  'yh_academy_roadmap_profile_v1'

const LOCK_KEY =
  'yh_academy_roadmap_locked_v1'

const MEMBERSHIP_KEY =
  'yh_academy_membership_status_v1'

const REBUILD_KEY =
  'yh_academy_force_roadmap_rebuild_v1'

const NEW_CYCLE_KEY =
  'yh_academy_new_roadmap_cycle_v1'

const DRAFT_PREFIX =
  'yh_academy_roadmap_builder_draft_v1'

function clean(value = '') {
  return String(value ?? '').trim()
}

function stored(key = '') {
  try {
    return (
      localStorage.getItem(key) ||
      sessionStorage.getItem(key) ||
      ''
    )
  } catch {
    return ''
  }
}

function draftKey() {
  const owner =
    clean(
      stored('yh_user_email') ||
      stored('yh_user_username') ||
      stored('yh_user_name') ||
      'current-user',
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9@._-]+/g,
        '_',
      )
      .slice(0, 160)

  return `${DRAFT_PREFIX}:${owner}`
}

const DEFAULT_FORM = {
  roadmapEvolutionStyle:
    'ai_guided_seasons',

  focusAreaKey: '',

  monthlyFocusMode:
    'ai_recommend',

  seasonStartMode:
    'next_sunday',

  firstSeasonLabel:
    '28-Day Foundation Reset',

  currentLevel: '',
  target30Days: '',
  dailyHours: '',
  weeklyHours: '',
  sleepHours: '',
  energyScore: '',
  stressScore: '',
  badHabit: '',
  blockerText: '',

  coachTone:
    'balanced',

  firstQuickWin: '',
  goalType: '',

  roadmapIntensity:
    'balanced',

  bestExecutionWindow: '',

  accountabilityStyle:
    'mentor_style',

  missionFormat:
    'simple_checklist',

  weeklyReviewDay:
    'Saturday',

  obstacleType: '',

  progressVisibility:
    'private',

  routineSnapshot: '',
  scopeAnswers: {},
}

const SELECTS = {
  currentLevel: [['Beginner','Beginner'],['Intermediate','Intermediate'],['Advanced','Advanced']],
  goalType: [['30_day_reset','30-day reset'],['skill_building','Skill-building roadmap'],['money_making','Money-making roadmap'],['discipline','Discipline roadmap'],['study_exam','Study / exam roadmap'],['networking','Networking roadmap'],['body_transformation','Body transformation roadmap'],['deep_knowledge','Deep knowledge roadmap']],
  roadmapEvolutionStyle: [['focused_mastery','Focused Mastery'],['rotating_life_upgrade','Rotating Life Upgrade'],['ai_guided_seasons','AI-Guided Seasons'],['user_chosen_monthly','Choose Monthly Myself']],
  monthlyFocusMode: [['continue_same_pillar','Continue same pillar'],['rotate_monthly','Rotate monthly'],['ai_recommend','AI recommends monthly focus'],['user_choose_monthly','Choose Monthly Myself']],
  roadmapIntensity: [['balanced','Balanced'],['light','Light'],['aggressive','Aggressive'],['elite','Elite Mode']],
  coachTone: [['balanced','Balanced'],['strict','Strict'],['supportive','Supportive']],
  accountabilityStyle: [['mentor_style','Mentor-style coaching'],['gentle','Gentle reminders'],['strict_pressure','Strict pressure'],['competitive','Competitive ranking'],['private_tracking','Private self-tracking']],
  missionFormat: [['simple_checklist','Simple checklist'],['detailed_steps','Detailed instructions'],['challenge_mode','Challenge mode'],['study_guide','Study guide style'],['business_execution','Business execution style'],['reflection_style','Reflection style']],
  progressVisibility: [['private','Private'],['mentor_admin','Visible to mentors/admin only'],['community','Visible to community'],['milestones_only','Visible only when I complete milestones']],
  weeklyReviewDay: [['Saturday','Saturday'],['Sunday','Sunday'],['Monday','Monday'],['Friday','Friday']],
  bestExecutionWindow: [['morning','Morning'],['afternoon','Afternoon'],['night','Night'],['late_night','Late night'],['no_fixed_time','No fixed time']],
  obstacleType: [['confusion','Confusion / no clear direction'],['low_energy','Low energy'],['fear','Fear of starting'],['no_money','No money'],['no_time','No time'],['bad_habits','Bad habits'],['lack_of_support','Lack of support'],['too_many_ideas','Too many ideas'],['procrastination','Procrastination']],
  energyScore: [['1','1 - Very Low'],['2','2 - Low'],['3','3 - Medium'],['4','4 - Good'],['5','5 - Very Strong']],
  stressScore: [['1','1 - Very Low'],['2','2 - Low'],['3','3 - Medium'],['4','4 - High'],['5','5 - Very High']],
}

/* Exact visible original academy.html intake fields (hidden season fields stay in payload). */
const BASE_FIELDS = [
  {key:'currentLevel',label:'Current Level',type:'select',required:true},
  {key:'target30Days',label:'Main 30-Day Target',type:'textarea',required:true,wide:true,placeholder:'What exact result do you want in the next 30 days?'},
  {key:'dailyHours',label:'Daily Time Available (hours)',type:'number',required:true,step:'0.25',placeholder:'e.g. 1.5'},
  {key:'weeklyHours',label:'Weekly Time Available (hours)',type:'number',required:true,step:'1',placeholder:'e.g. 12'},
  {key:'sleepHours',label:'Sleep Hours',type:'number',step:'1',placeholder:'e.g. 6'},
  {key:'energyScore',label:'Energy Level',type:'select'},
  {key:'stressScore',label:'Stress Level',type:'select'},
  {key:'badHabit',label:'Main Bad Habit',placeholder:'e.g. procrastination, late sleeping, distractions'},
  {key:'blockerText',label:'Biggest Bottleneck Right Now',type:'textarea',required:true,wide:true,placeholder:'What is the biggest thing slowing your progress down?'},
  {key:'firstQuickWin',label:'First Quick Win You Want',type:'textarea',wide:true,placeholder:'What should the AI help you win first?'},
  {key:'coachTone',label:'Preferred Coach Tone',type:'select'},
  {key:'goalType',label:'Roadmap Goal Type',type:'select'},
  {key:'roadmapIntensity',label:'Roadmap Intensity',type:'select'},
  {key:'bestExecutionWindow',label:'Best Execution Time',type:'select'},
  {key:'accountabilityStyle',label:'Accountability Style',type:'select'},
  {key:'missionFormat',label:'Preferred Mission Format',type:'select'},
  {key:'weeklyReviewDay',label:'Weekly Review Day',type:'select'},
  {key:'obstacleType',label:'Obstacle Diagnosis',type:'select'},
  {key:'progressVisibility',label:'Progress Visibility',type:'select'},
  {key:'routineSnapshot',label:'Current Routine Snapshot',type:'textarea',wide:true,rows:3,placeholder:'Wake-up time, work/school hours, free time, distractions, sleep time...'},
]

const EVOLUTION_CARDS = [
  ['focused_mastery','continue_same_pillar','Focused Mastery','Stay on one main pillar for multiple months until it becomes strong.'],
  ['rotating_life_upgrade','rotate_monthly','Rotating Life Upgrade','Move through different life areas month by month.'],
  ['ai_guided_seasons','ai_recommend','AI-Guided Seasons','Let AI recommend the next monthly focus based on progress.'],
  ['user_chosen_monthly','user_choose_monthly','Choose Monthly Myself','Pick a new pillar yourself at the end of every month.'],
]
const PILLAR_CARDS = [
  ['money_business','Money, Wealth & Business','Income skill, offers, sales, business execution, and financial direction.'],
  ['mindset_psychology','Mindset & Psychology','Discipline, identity, self-control, habits, and inner operating system.'],
  ['fitness_health','Fitness & Health','Energy, body, sleep, movement, nutrition, and daily physical standard.'],
  ['communication_networking','Communication & Networking','Confidence, conversations, outreach, public speaking, and high-value connections.'],
  ['knowledge_for_life','Knowledge for Life','Learning, awareness, worldview, practical knowledge, and long-term thinking.'],
  ['politics_2030_agenda','Politics & 2030 Agenda','Power, governance, global systems, narratives, and geopolitical understanding.'],
  ['philosophy','Philosophy','Truth, meaning, ethics, logic, reasoning, and self-mastery.'],
]
const BOTTLENECK_CHIPS = [
  ['Procrastination','I procrastinate too much and struggle to stay consistent.'],
  ['No clear direction','I do not have a clear direction yet, so I keep jumping between ideas.'],
  ['Low energy','I have low energy and find it hard to execute consistently every day.'],
  ['Distractions','I get distracted easily and waste time on low-value activities.'],
  ['Too many ideas','I have too many ideas and need help focusing on one clear path.'],
]

function readDraft(mode) {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          draftKey(),
        ) || 'null',
      )

    return (
      parsed &&
      parsed.mode === mode &&
      parsed.form
    )
      ? parsed.form
      : null
  } catch {
    return null
  }
}

function writeDraft(
  mode,
  form,
) {
  try {
    localStorage.setItem(
      draftKey(),
      JSON.stringify({
        version: 1,
        mode,
        form,
        savedAt:
          new Date().toISOString(),
      }),
    )
  } catch {}
}

function clearDraft() {
  try {
    localStorage.removeItem(
      draftKey(),
    )
  } catch {}
}

function weak(value = '') {
  const text =
    clean(value).toLowerCase()

  const weakAnswers =
    new Set([
      'idk',
      'i dont know',
      "i don't know",
      'none',
      'nothing',
      'money',
      'success',
      'fitness',
      'business',
      'discipline',
      'good',
      'better',
    ])

  return (
    !text ||
    text.length < 12 ||
    weakAnswers.has(text)
  )
}

function accuracyScore(
  form,
  config,
) {
  let score = 0

  ;[
    form.roadmapEvolutionStyle,
    form.focusAreaKey,
    form.currentLevel,
    form.target30Days,
    form.dailyHours,
    form.weeklyHours,
    form.blockerText,
  ].forEach((value) => {
    if (clean(value)) {
      score += 9
    }
  })

  if (!weak(form.target30Days)) {
    score += 12
  }

  if (!weak(form.blockerText)) {
    score += 12
  }

  if (clean(form.goalType)) {
    score += 4
  }

  if (clean(form.roadmapIntensity)) {
    score += 4
  }

  if (clean(form.obstacleType)) {
    score += 4
  }

  if (clean(form.bestExecutionWindow)) {
    score += 3
  }

  if (
    clean(
      form.routineSnapshot,
    ).length >= 24
  ) {
    score += 3
  }

  const answered =
    (config?.fields || [])
      .filter(
        (field) =>
          clean(
            form.scopeAnswers?.[
              field.key
            ],
          ),
      ).length

  score += Math.min(
    8,
    answered * 2,
  )

  return Math.min(
    100,
    Math.max(
      0,
      score,
    ),
  )
}

function InputField({
  field,
  value,
  onChange,
}) {
  if (
    field.type === 'select'
  ) {
    const options =
      field.options
        ? field.options.map(
            (item) => [
              item.value,
              item.label,
            ],
          )
        : SELECTS[
            field.key
          ] || []

    return (
      <select
        className="input-field"
        required={
          field.required ===
          true
        }
        value={value || ''}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
      >
        {!value && (
          <option value="">
            Select...
          </option>
        )}

        {options.map(
          ([optionValue, label]) => (
            <option
              key={optionValue}
              value={optionValue}
            >
              {label}
            </option>
          ),
        )}
      </select>
    )
  }

  if (
    field.type ===
    'textarea'
  ) {
    return (
      <textarea
        className="input-field"
        rows={field.rows || 3}
        required={
          field.required ===
          true
        }
        value={value || ''}
        placeholder={
          field.placeholder ||
          ''
        }
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
      />
    )
  }

  return (
    <input
      className="input-field"
      type={
        field.type ||
        'text'
      }
      required={
        field.required ===
        true
      }
      min={
        field.type === 'number'
          ? '0'
          : undefined
      }
      step={field.step || (field.type === 'number' ? '0.25' : undefined)}
      value={value || ''}
      placeholder={
        field.placeholder ||
        ''
      }
      onChange={(event) =>
        onChange(
          event.target.value,
        )
      }
    />
  )
}

export default function AcademyRoadmapBuilder({
  mode = 'build',
  onClose,
  onComplete,
  onToast,
}) {
  const [
    form,
    setForm,
  ] = useState(() => ({
    ...DEFAULT_FORM,
    ...(readDraft(mode) || {}),
  }))

  const [
    busy,
    setBusy,
  ] = useState(false)

  const [phase, setPhase] = useState(1)
  const formRef = useRef(null)

  const config =
    useMemo(
      () =>
        ROADMAP_SCOPE_CONFIG[
          form.focusAreaKey
        ] || null,
      [form.focusAreaKey],
    )

  const accuracy =
    useMemo(
      () =>
        accuracyScore(
          form,
          config,
        ),
      [form, config],
    )

  useEffect(() => {
    const timer =
      window.setTimeout(
        () =>
          writeDraft(
            mode,
            form,
          ),
        180,
      )

    return () =>
      window.clearTimeout(
        timer,
      )
  }, [mode, form])

  const setValue =
    (key, value) =>
      setForm(
        (current) => ({
          ...current,
          [key]: value,
        }),
      )

  const setScopeValue =
    (key, value) =>
      setForm(
        (current) => ({
          ...current,

          scopeAnswers: {
            ...current.scopeAnswers,
            [key]: value,
          },
        }),
      )

  const submit =
    async (event) => {
      event.preventDefault()

      if (
        busy ||
        !config
      ) {
        return
      }

      if (
        weak(
          form.target30Days,
        )
      ) {
        onToast?.(
          'Make your 28-day target more specific before building your roadmap.',
          'error',
        )
        return
      }

      if (
        weak(
          form.blockerText,
        )
      ) {
        onToast?.(
          'Explain your biggest bottleneck more clearly before building your roadmap.',
          'error',
        )
        return
      }

      const missingScope =
        (config.fields || [])
          .find(
            (field) =>
              field.required &&
              !clean(
                form.scopeAnswers?.[
                  field.key
                ],
              ),
          )

      if (missingScope) {
        onToast?.(
          `Complete: ${missingScope.label}`,
          'error',
        )
        return
      }

      setBusy(true)

      const rebuild =
        mode === 'rebuild'

      const newCycle =
        mode === 'new-cycle'

      const dailyHours =
        Number(
          form.dailyHours,
        )

      const payload = {
        focusArea:
          config.label,

        focusAreaKey:
          form.focusAreaKey,

        schemaKey:
          config.schemaKey,

        intakeVersion: 4,

        roadmapEvolutionStyle:
          form.roadmapEvolutionStyle,

        roadmapEvolutionLabel:
          SELECTS
            .roadmapEvolutionStyle
            .find(
              ([value]) =>
                value ===
                form.roadmapEvolutionStyle,
            )?.[1] ||
          'AI-Guided Seasons',

        monthlyFocusMode:
          form.monthlyFocusMode,

        monthlyFocusLabel:
          SELECTS
            .monthlyFocusMode
            .find(
              ([value]) =>
                value ===
                form.monthlyFocusMode,
            )?.[1] ||
          'AI recommends monthly focus',

        seasonStartMode:
          form.seasonStartMode,

        firstSeasonLabel:
          clean(
            form.firstSeasonLabel,
          ) ||
          '28-Day Foundation Reset',

        foundationPhaseDays:
          28,

        yearPlanMonths:
          12,

        currentLevel:
          clean(
            form.currentLevel,
          ),

        target30Days:
          clean(
            form.target30Days,
          ),

        dailyHours:
          clean(
            form.dailyHours,
          ),

        dailyMinutes:
          Number.isFinite(
            dailyHours,
          ) &&
          dailyHours > 0
            ? String(
                Math.round(
                  dailyHours *
                    60,
                ),
              )
            : '',

        weeklyHours:
          clean(
            form.weeklyHours,
          ),

        sleepHours:
          clean(
            form.sleepHours,
          ),

        energyScore:
          clean(
            form.energyScore,
          ),

        stressScore:
          clean(
            form.stressScore,
          ),

        badHabit:
          clean(
            form.badHabit,
          ),

        blockerText:
          clean(
            form.blockerText,
          ),

        coachTone:
          form.coachTone,

        firstQuickWin:
          clean(
            form.firstQuickWin,
          ),

        goalType:
          clean(
            form.goalType,
          ),

        roadmapIntensity:
          form.roadmapIntensity,

        bestExecutionWindow:
          clean(
            form.bestExecutionWindow,
          ),

        accountabilityStyle:
          form.accountabilityStyle,

        missionFormat:
          form.missionFormat,

        weeklyReviewDay:
          form.weeklyReviewDay,

        obstacleType:
          clean(
            form.obstacleType,
          ),

        progressVisibility:
          form.progressVisibility,

        routineSnapshot:
          clean(
            form.routineSnapshot,
          ),

        roadmapAccuracyScore:
          accuracy,

        scopeAnswers:
          form.scopeAnswers,

        seasonPlan: {
          currentSeason: {
            month: 1,

            label:
              clean(
                form.firstSeasonLabel,
              ) ||
              '28-Day Foundation Reset',

            pillar:
              form.focusAreaKey,

            pillarLabel:
              config.label,

            durationDays:
              28,

            status:
              'active_after_creation',
          },

          nextSeason: {
            month: 2,
            label:
              'Next Monthly Focus',

            selectionMode:
              form.monthlyFocusMode,

            status:
              'pending_review',
          },

          reviewCadence:
            'monthly',

          totalMonths:
            12,
        },

        forceRoadmapRebuild:
          rebuild,

        startNewRoadmapCycle:
          newCycle,

        submittedAt:
          new Date()
            .toISOString(),
      }

      try {
        localStorage.setItem(
          PROFILE_KEY,
          JSON.stringify(
            payload,
          ),
        )

        if (rebuild) {
          sessionStorage.setItem(
            REBUILD_KEY,
            '1',
          )
        }

        if (newCycle) {
          sessionStorage.setItem(
            NEW_CYCLE_KEY,
            '1',
          )
        }

        const result =
          await apiFetch(
            '/api/academy/roadmap-apply',
            {
              method: 'POST',

              body:
                JSON.stringify(
                  payload,
                ),
            },
          )

        const application =
          result?.roadmapApplication &&
          typeof result
            .roadmapApplication ===
            'object'
            ? result
                .roadmapApplication
            : null

        let membership = {}

        try {
          membership =
            JSON.parse(
              localStorage.getItem(
                MEMBERSHIP_KEY,
              ) || '{}',
            ) || {}
        } catch {}

        localStorage.setItem(
          MEMBERSHIP_KEY,
          JSON.stringify({
            ...membership,

            roadmapApplication:
              application,

            roadmapApplicationStatus:
              clean(
                application?.status ||
                  'Approved',
              ).toLowerCase(),

            hasRoadmapAccess:
              true,

            roadmapAccessStatus:
              'unlocked',

            canEnterAcademy:
              true,
          }),
        )

        localStorage.removeItem(
          LOCK_KEY,
        )

        sessionStorage.removeItem(
          REBUILD_KEY,
        )

        sessionStorage.removeItem(
          NEW_CYCLE_KEY,
        )

        clearDraft()

        onToast?.(
          newCycle
            ? 'Main focus changed. Your new Roadmap cycle is ready.'
            : rebuild
              ? 'Personalized Roadmap rebuilt successfully.'
              : 'Roadmap setup complete. Your roadmap is now unlocked.',
          'success',
        )

        await onComplete?.(
          result,
          payload,
        )
      } catch (error) {
        /* YHU_ACADEMY_A03_ROADMAP_ERROR_PRESERVE_LOCK */

        onToast?.(
          error?.message ||
            'Failed to submit roadmap application.',
          'error',
        )
      } finally {
        setBusy(false)
      }
    }


  const advanceDiagnosis = () => {
    if (!formRef.current?.reportValidity()) return
    if (weak(form.target30Days)) {
      onToast?.('Make your 28-day target more specific before continuing.', 'error')
      return
    }
    if (weak(form.blockerText)) {
      onToast?.('Explain your biggest bottleneck more clearly before continuing.', 'error')
      return
    }
    const missingScope = (config?.fields || []).find(field => field.required && !clean(form.scopeAnswers?.[field.key]))
    if (missingScope) {
      onToast?.('Complete: ' + missingScope.label, 'error')
      return
    }
    setPhase(4)
  }
  const daily = Number(form.dailyHours)
  const evolutionLabel = SELECTS.roadmapEvolutionStyle.find(([key]) => key === form.roadmapEvolutionStyle)?.[1] || 'AI-Guided Seasons'
  const diagnosticRisk = clean(form.obstacleType || form.blockerText) || 'Not diagnosed'
  const phaseButtons = (back, forward, label) => (
    <div className="roadmap-phase-actions roadmap-phase-actions-split">
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => setPhase(back)}>← Back</button>
      <button type="button" className="btn-primary" disabled={busy} onClick={forward}>{label}</button>
    </div>
  )
  return createPortal(
    <div id="academy-roadmap-modal" className="modal-overlay yhu-academy-p1" role="dialog" aria-modal="true" aria-label="Academy Roadmap Builder"
      style={{zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div className="modal-content hide-scrollbar" style={{position:'relative',maxWidth:720,width:'100%',maxHeight:'85vh',overflowY:'auto',padding:'3rem 2.5rem',background:'var(--panel-dark)',border:'1px solid rgba(255,255,255,.1)',borderRadius:20}}>
        <button type="button" id="close-academy-roadmap" aria-label="Close Roadmap Builder" disabled={busy} onClick={onClose}
          style={{position:'absolute',right:20,top:20,background:'rgba(255,255,255,.05)',border:0,color:'var(--text-muted)',padding:10,borderRadius:'50%'}}>✖</button>
        <form id="form-academy-roadmap" ref={formRef} className="roadmap-builder-form" onSubmit={event => {
          if (phase !== 5) {event.preventDefault();return}
          void submit(event)
        }}>
          <div className="roadmap-builder-progress" aria-label="Roadmap builder progress">
            {['Promise','Focus','Diagnosis','Preview','Commit'].map((label,index) => (
              <span key={label} data-roadmap-progress-step={index + 1} className={phase===index+1?'is-active':phase>index+1?'is-complete':''}>{label}</span>
            ))}
          </div>
          {phase===1 && (
            <div id="roadmap-phase-1" className="roadmap-intake-phase">
              <div className="roadmap-builder-hero text-center mb-1-25">
                <div className="roadmap-step-kicker">Step 1 of 5 · Foundation promise</div>
                <h2 className="yh-title-small" style={{color:'var(--neon-blue)'}}>Build your 28-Day Foundation</h2>
                <p className="yh-subtitle-small">Your first 28 days are for discipline, direction, and a daily standard. After that, your Roadmap evolves month by month across the next 12 months.</p>
              </div>
              <div className="roadmap-season-choice-panel">
                <div className="roadmap-shared-kicker">Choose how your Roadmap should evolve</div>
                <div className="roadmap-builder-card-grid roadmap-builder-card-grid-2">
                  {EVOLUTION_CARDS.map(([key,monthly,title,copy]) => (
                    <button key={key} type="button" className={'roadmap-builder-card'+(form.roadmapEvolutionStyle===key?' is-selected':'')}
                      data-roadmap-evolution-value={key} aria-pressed={form.roadmapEvolutionStyle===key}
                      onClick={() => setForm(current => ({...current,roadmapEvolutionStyle:key,monthlyFocusMode:monthly}))}>
                      <strong>{title}</strong><span>{copy}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="roadmap-phase-actions"><button type="button" id="btn-roadmap-start" className="btn-primary w-full" onClick={() => setPhase(2)}>Start Roadmap Builder ➔</button></div>
            </div>
          )}
          {phase===2 && (
            <div id="roadmap-phase-2" className="roadmap-intake-phase">
              <div className="text-center mb-1-25">
                <div className="roadmap-step-kicker">Step 2 of 5 · First focus</div>
                <h2 className="yh-title-small" style={{color:'var(--neon-blue)'}}>What should your first Roadmap focus on?</h2>
                <p className="yh-subtitle-small">Month 1 will still build your 28-day foundation. This focus tells the AI what part of your life needs the most attention first.</p>
              </div>
              <select id="roadmap-focus-area" required className="input-field styled-select roadmap-hidden-native-select" value={form.focusAreaKey} aria-label="Choose Your Main Pillar"
                onChange={event => setForm(current => ({...current,focusAreaKey:event.target.value,scopeAnswers:{}}))}>
                <option value="">Select pillar.</option>
                {Object.entries(ROADMAP_SCOPE_CONFIG).map(([key,definition]) => <option key={key} value={key}>{definition.label}</option>)}
              </select>
              <div id="roadmap-pillar-card-grid" className="roadmap-builder-card-grid roadmap-pillar-card-grid">
                {PILLAR_CARDS.map(([key,title,description]) => (
                  <button key={key} type="button" className={'roadmap-builder-card'+(form.focusAreaKey===key?' is-selected':'')} data-roadmap-pillar-value={key} aria-pressed={form.focusAreaKey===key}
                    onClick={() => setForm(current => ({...current,focusAreaKey:key,scopeAnswers:{}}))}>
                    <strong>{title}</strong><span>{description}</span>
                  </button>
                ))}
              </div>
              {phaseButtons(1,() => {if(!config){onToast?.('Choose your first Roadmap focus first.','error');return}setPhase(3)},'Continue ➔')}
            </div>
          )}
          {phase===3 && (
            <div id="roadmap-phase-3" className="roadmap-intake-phase">
              <div className="roadmap-scope-header mb-small">
                <div className="roadmap-step-kicker">Step 3 of 5 · AI diagnosis</div>
                <h3 className="roadmap-scope-title">{config?.sectionTitle || 'AI intake questions'}</h3>
                <p className="roadmap-scope-copy">{config?.sectionCopy || 'Answer the essentials so the AI can build a sharper foundation and monthly roadmap seasons.'}</p>
                <div className="roadmap-selected-scope-chip">{config?.label || 'No scope selected'}</div>
              </div>
              <div id="roadmap-scope-questions" className="academy-lead-form-grid">
                {(config?.fields || []).map(field => (
                  <label key={field.key} className="form-group"><span>{field.label}</span>
                    <InputField field={field} value={form.scopeAnswers?.[field.key] || ''} onChange={value => setScopeValue(field.key,value)} />
                  </label>
                ))}
              </div>
              <div className="roadmap-shared-section">
                <div className="roadmap-shared-kicker">Shared execution context</div>
                <div className="academy-lead-form-grid">
                  {BASE_FIELDS.map(field => (
                    <label key={field.key} className={'form-group'+(field.wide?' academy-lead-form-span-2':'')}><span>{field.label}</span>
                      <InputField field={field} value={form[field.key]} onChange={value => setValue(field.key,value)} />
                    </label>
                  ))}
                </div>
                <div className="roadmap-answer-chip-panel">
                  <div className="roadmap-shared-kicker">Quick answer chips</div>
                  <p className="roadmap-smart-copy">Click a chip to quickly fill your biggest bottleneck.</p>
                  <div className="roadmap-answer-chip-row">
                    {BOTTLENECK_CHIPS.map(([title,value]) => <button type="button" key={title} className="roadmap-answer-chip" onClick={() => setValue('blockerText',value)}>{title}</button>)}
                  </div>
                </div>
              </div>
              {phaseButtons(2,advanceDiagnosis,'Preview My Roadmap DNA ➔')}
            </div>
          )}
          {phase===4 && (
            <div id="roadmap-phase-4" className="roadmap-intake-phase">
              <div className="text-center mb-1-25">
                <div className="roadmap-step-kicker">Step 4 of 5 · Roadmap DNA</div>
                <h2 className="yh-title-small" style={{color:'var(--neon-blue)'}}>Preview your Roadmap DNA</h2>
                <p className="yh-subtitle-small">This is the simple profile the AI will use to build your first 28 days and prepare your next 12 months.</p>
              </div>
              <div className="roadmap-dna-card">
                <div className="roadmap-diagnosis-head"><div><div className="roadmap-shared-kicker">AI Diagnosis Preview</div><h4>Roadmap Accuracy</h4></div><strong>{accuracy}%</strong></div>
                <div className="roadmap-accuracy-track"><div className="roadmap-accuracy-fill" style={{width:accuracy+'%'}} /></div>
                <p>Start answering the form. The AI will estimate how clear your roadmap profile is before submission.</p>
                <div className="roadmap-dna-grid">
                  {[['First Season',form.firstSeasonLabel],['First Focus',config?.label],['Evolution Style',evolutionLabel],['Daily Load',Number.isFinite(daily) && daily>0?Math.round(daily*60)+' minutes/day':'Not set'],['Coach Tone',form.coachTone],['Main Risk',diagnosticRisk.slice(0,54)]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value || 'Not set'}</strong></div>)}
                </div>
              </div>
              {phaseButtons(3,() => setPhase(5),'Continue to Commitment ➔')}
            </div>
          )}
          {phase===5 && (
            <div id="roadmap-phase-5" className="roadmap-intake-phase">
              <div className="roadmap-commitment-card text-center">
                <div className="roadmap-step-kicker">Step 5 of 5 · Lock in</div>
                <h2 className="yh-title-small" style={{color:'var(--neon-blue)'}}>Your first 28 days start next Sunday.</h2>
                <p className="yh-subtitle-small">The goal is not to fix everything today. The goal is to install a new standard, complete one honest mission at a time, then let your Roadmap evolve into monthly seasons.</p>
                <div className="roadmap-commitment-strip"><span>28-Day Foundation</span><span>Monthly Seasons</span><span>12-Month Growth Path</span></div>
              </div>
              <div className="roadmap-phase-actions roadmap-phase-actions-split">
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => setPhase(4)}>← Back</button>
                <button type="submit" className="btn-primary" disabled={busy}>{busy?'Analyzing answers...':'Build My AI Roadmap ➔'}</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body
  )
}
