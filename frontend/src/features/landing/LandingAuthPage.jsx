import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { createPortal } from 'react-dom'

import {
  io,
} from 'socket.io-client'

import {
  POST_LOGIN_KEY,
  captureReferralFromUrl,
  clearFreshAuthState,
  clearPendingVerifyEmail,
  clearReferralCode,
  getPendingVerifyEmail,
  getPublicApiBase,
  getReferralCode,
  isDeletedAccountResult,
  persistClientSession,
  publicJson,
  setPendingVerifyEmail,
} from './landingAuth'

import './LandingAuthPage.css'

const DEFAULT_FEED = [
  {
    id:
      'academy_live_placeholder_1',
    label:
      'Universe Feed',
    feedText:
      'Live sync active.',
    locationText:
      'Global',
  },
  {
    id:
      'academy_live_placeholder_2',
    label:
      'Growth Signal',
    feedText:
      'New activity ready.',
    locationText:
      'Network',
  },
  {
    id:
      'academy_live_placeholder_3',
    label:
      'Map Sync',
    feedText:
      'Signals online.',
    locationText:
      'World',
  },
]

const EMPTY_REGISTER = {
  fullName: '',
  email: '',
  username: '',
  city: '',
  country: '',
  password: '',
  confirmPassword: '',
}

function clean(
  value = '',
) {
  return String(
    value ?? '',
  ).trim()
}

function safeArray(
  value,
) {
  return Array.isArray(
    value,
  )
    ? value
    : []
}

function normalizeFeed(
  payload = {},
) {
  const source =
    safeArray(
      payload.liveEvents,
    ).length
      ? payload.liveEvents
      : safeArray(
          payload.academyEvents,
        )

  const normalized =
    source
      .map(
        (
          item,
          index,
        ) => ({
          id:
            clean(
              item.id ||
                item.eventId,
            ) ||
            `landing-${index}`,

          label:
            clean(
              item.label ||
                item.title ||
                item.type,
            ) ||
            'Universe Signal',

          feedText:
            clean(
              item.feedText ||
                item.text ||
                item.description ||
                item.message,
            ) ||
            'New activity detected.',

          locationText:
            clean(
              item.locationText ||
                item.location ||
                item.city ||
                item.country,
            ) ||
            'Global',
        }),
      )
      .filter(
        (item) =>
          item.feedText ||
          item.label,
      )

  return normalized.length
    ? normalized
    : DEFAULT_FEED
}

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  inputClassName = '',
}) {
  const [
    visible,
    setVisible,
  ] = useState(false)

  return (
    <div className="yh-react-password-shell">
      <input
        className={inputClassName}
        type={
          visible
            ? 'text'
            : 'password'
        }
        value={value}
        placeholder={placeholder}
        autoComplete={
          autoComplete
        }
        onChange={
          onChange
        }
      />

      <button
        type="button"
        onClick={() =>
          setVisible(
            (current) =>
              !current,
          )
        }
      >
        {visible
          ? 'Hide'
          : 'Show'}
      </button>
    </div>
  )
}

function Toast({
  toast,
  onClose,
}) {
  useEffect(() => {
    if (!toast?.message) {
      return undefined
    }

    const timer =
      window.setTimeout(
        onClose,
        3200,
      )

    return () =>
      window.clearTimeout(
        timer,
      )
  }, [
    toast,
    onClose,
  ])

  if (!toast?.message) {
    return null
  }

  return (
    <div
      className={
        'yh-react-landing-toast ' +
        (
          toast.type ===
          'error'
            ? 'is-error'
            : 'is-success'
        )
      }
      role="status"
      aria-live="polite"
    >
      <strong>
        {toast.type ===
        'error'
          ? '!'
          : '✓'}
      </strong>

      <span>
        {toast.message}
      </span>
    </div>
  )
}

function Cropper({
  source,
  onCancel,
  onApply,
}) {
  const [
    zoom,
    setZoom,
  ] = useState(1)

  const [
    offset,
    setOffset,
  ] = useState({
    x: 0,
    y: 0,
  })

  const dragRef =
    useRef(null)

  const handlePointerDown =
    (event) => {
      event.currentTarget
        .setPointerCapture?.(
          event.pointerId,
        )

      dragRef.current = {
        startX:
          event.clientX,
        startY:
          event.clientY,
        x:
          offset.x,
        y:
          offset.y,
      }
    }

  const handlePointerMove =
    (event) => {
      const drag =
        dragRef.current

      if (!drag) {
        return
      }

      const rect =
        event.currentTarget
          .getBoundingClientRect()

      const scale =
        2 /
        Math.max(
          1,
          rect.width,
        )

      setOffset({
        x:
          Math.max(
            -1,
            Math.min(
              1,
              drag.x +
                (
                  event.clientX -
                  drag.startX
                ) *
                  scale,
            ),
          ),

        y:
          Math.max(
            -1,
            Math.min(
              1,
              drag.y +
                (
                  event.clientY -
                  drag.startY
                ) *
                  scale,
            ),
          ),
      })
    }

  const handlePointerUp =
    () => {
      dragRef.current =
        null
    }

  return (
    <div className="yh-react-crop-overlay">
      <div
        className="yh-react-crop-dialog"
        role="dialog"
        aria-modal="true"
      >
        <div className="yh-react-crop-head">
          <div>
            <h3>
              Crop Profile Photo
            </h3>

            <p>
              Drag the image and
              adjust zoom.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <div
          className="yh-react-crop-stage"
          onPointerDown={
            handlePointerDown
          }
          onPointerMove={
            handlePointerMove
          }
          onPointerUp={
            handlePointerUp
          }
          onPointerCancel={
            handlePointerUp
          }
        >
          <img
            src={source}
            alt=""
            draggable="false"
            style={{
              transform:
                `translate(${offset.x * 24}%, ${offset.y * 24}%) scale(${zoom})`,
            }}
          />

          <div className="yh-react-crop-ring" />
        </div>

        <label className="yh-react-crop-zoom">
          <span>
            Zoom
          </span>

          <input
            type="range"
            min="1"
            max="4"
            step="0.01"
            value={zoom}
            onChange={(
              event,
            ) =>
              setZoom(
                Number(
                  event.target
                    .value,
                ),
              )
            }
          />
        </label>

        <div className="yh-react-crop-actions">
          <button
            type="button"
            className="yh-react-btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className="yh-react-btn-primary"
            onClick={() =>
              onApply({
                zoom,
                offset,
              })
            }
          >
            Use Cropped Photo
          </button>
        </div>
      </div>
    </div>
  )
}

async function loadImage(
  src,
) {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const image =
        new Image()

      image.onload =
        () =>
          resolve(
            image,
          )

      image.onerror =
        reject

      image.src =
        src
    },
  )
}

async function cropSquare(
  source,
  {
    zoom = 1,
    offset = {
      x: 0,
      y: 0,
    },
  } = {},
) {
  const image =
    await loadImage(
      source,
    )

  const canvas =
    document.createElement(
      'canvas',
    )

  const size = 320

  canvas.width =
    size

  canvas.height =
    size

  const context =
    canvas.getContext(
      '2d',
    )

  if (!context) {
    throw new Error(
      'Image crop is unavailable.',
    )
  }

  const base =
    Math.min(
      image.naturalWidth,
      image.naturalHeight,
    )

  const sourceSize =
    Math.max(
      1,
      base /
        Math.max(
          1,
          Number(zoom) ||
            1,
        ),
    )

  const maxX =
    Math.max(
      0,
      image.naturalWidth -
        sourceSize,
    )

  const maxY =
    Math.max(
      0,
      image.naturalHeight -
        sourceSize,
    )

  const x =
    maxX *
    (
      (
        Math.max(
          -1,
          Math.min(
            1,
            offset.x || 0,
          ),
        ) +
        1
      ) /
      2
    )

  const y =
    maxY *
    (
      (
        Math.max(
          -1,
          Math.min(
            1,
            offset.y || 0,
          ),
        ) +
        1
      ) /
      2
    )

  context.drawImage(
    image,
    x,
    y,
    sourceSize,
    sourceSize,
    0,
    0,
    size,
    size,
  )

  return canvas.toDataURL(
    'image/jpeg',
    0.82,
  )
}


// YHU_L09_FIX4_RETRY
// YHU_L09_FIX2_POLISH
// YHU_L11_AEROSPACE_GATEWAY — Visual-only spaceship
function YhuAerospaceCraft() {
  return (
    <svg viewBox="0 0 360 160"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" focusable="false">
      <path d="M41 79 91 63 204 65 348 80 204 95 91 97Z"
        fill="#0a2445" stroke="#62dfff" strokeWidth="2"/>
      <path d="M102 66 171 16 225 22 207 73Z"
        fill="#174977" stroke="#72dfff" strokeWidth="2"/>
      <path d="M102 94 171 144 225 138 207 87Z"
        fill="#123a66" stroke="#72dfff" strokeWidth="2"/>
      <path d="M95 74 204 74 319 80 204 86 95 86Z"
        fill="#84dfff" opacity=".48"/>
      <path d="M190 52 254 67 291 80 254 93 190 108 209 80Z"
        fill="#315f91" stroke="#baf5ff" strokeWidth="1.5"/>
      <ellipse cx="248" cy="80" rx="32" ry="10"
        fill="#061a37" stroke="#73e5ff" strokeWidth="2"/>
      <path d="M225 80h47"
        stroke="#a4f8ff" strokeWidth="2" strokeLinecap="round"/>
      <path d="M49 73 88 73 88 87 49 87Z"
        fill="#275e86" stroke="#72cfff" strokeWidth="1.5"/>
      <path d="M25 76 48 69 48 91 25 84Z"
        fill="#53d9ff" opacity=".9"/>
      <path d="M4 80 41 77 41 83Z"
        fill="#a5f5ff" opacity=".75"/>
    </svg>
  )
}

export default function LandingAuthPage({
  initialMode = 'login',
}) {
  const [
    mode,
    setMode,
  ] = useState(
    initialMode,
  )

  // YHU_L09_CLEANUP_L10
  // New React landing owns its layout.
  // Legacy styling activates only for existing auth dialogs.
  useEffect(() => {
    const previous = document.body.getAttribute('data-yh-page');

    const legacyModal = [
      'verify',
      'forgot',
      'forgot-verify',
      'reset',
      'reset-done'
    ].includes(mode);

    document.body.setAttribute(
      'data-yh-page',
      legacyModal ? 'apply' : 'landing-react'
    );

    return () => {
      if (previous === null) {
        document.body.removeAttribute('data-yh-page');
      } else {
        document.body.setAttribute('data-yh-page', previous);
      }
    };
  }, [mode]);

  const [
    toast,
    setToast,
  ] = useState(null)

  const [
    busy,
    setBusy,
  ] = useState('')

  const [
    postLogin,
    setPostLogin,
  ] = useState(false)

  const [
    login,
    setLogin,
  ] = useState({
    identifier: '',
    password: '',
  })

  const [
    register,
    setRegister,
  ] = useState(
    EMPTY_REGISTER,
  )

  const [
    croppedAvatar,
    setCroppedAvatar,
  ] = useState('')

  const [
    cropSource,
    setCropSource,
  ] = useState('')

  const [
    otp,
    setOtp,
  ] = useState('')

  const [
    otpSeconds,
    setOtpSeconds,
  ] = useState(120)

  const [
    resetEmail,
    setResetEmail,
  ] = useState('')

  const [
    resetOtp,
    setResetOtp,
  ] = useState('')

  const [
    resetPassword,
    setResetPassword,
  ] = useState({
    password: '',
    confirm: '',
  })

  const [feed, setFeed] = useState([])

  const [
    ,
    setLiveConnected,
  ] = useState(false)

  const [
    soundEnabled,

  setSoundEnabled,] = useState(() => {
    try {
      return (
        localStorage.getItem(
          'yh_landing_sound_enabled_v1',
        ) !== '0'
      )
    } catch {
      return true
    }
  })

  const authRef =
    useRef(null)

  // YHU_L09_BOLT_UI_SINGLE_OWNER
  // YHU_L09_SCROLL_FIX1
  const [landingVisible, setLandingVisible] = useState(
    () => window.location.pathname === '/'
  )

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeDivision, setActiveDivision] = useState(0)

  const enterTerminal = () => {
    setLandingVisible(false)
    setMobileMenuOpen(false)
    switchMode('login', { scroll: false })
  }


  useEffect(() => {
    document.body.classList.toggle(
      'yh-account-otp-modal-open',
      mode === 'verify'
    );

    return () => {
      document.body.classList.remove('yh-account-otp-modal-open');
    };
  }, [mode]);

  const showToast =
    useCallback(
      (
        message,
        type = 'success',
      ) => {
        setToast({
          message:
            clean(message) ||
            'Notification',
          type,
        })
      },
      [],
    )

  const playClick =
    useCallback(
      () => {
        if (
          !soundEnabled
        ) {
          return
        }

        try {
          const audio =
            new Audio(
              '/sounds/landing-button-click.wav',
            )

          audio.volume =
            0.35

          void audio.play()
            .catch(
              () => {},
            )
        } catch { /* Optional browser operation; failure is non-fatal. */ }
      },
      [soundEnabled],
    )

  const switchMode =
    useCallback(
      (
        nextMode,
        {
          scroll = true,
        } = {},
      ) => {
        playClick()
        setMode(
          nextMode,
        )

        if (
          nextMode ===
          'verify'
        ) {
          setOtpSeconds(
            120,
          )
        }

        if (scroll) {
          window.setTimeout(
            () => {
              authRef.current
                ?.scrollIntoView({
                  behavior:
                    'smooth',
                  block:
                    'center',
                })
            },
            30,
          )
        }
      },
      [playClick],
    )

  // YHU_L11_AEROSPACE_GATEWAY — Visual transition only
  const [aeroFlight, setAeroFlight] = useState(null)
  const aeroTimers = useRef([])

  useEffect(() => () => {
    aeroTimers.current.forEach(id => window.clearTimeout(id))
    aeroTimers.current = []
  }, [])

  const navigateAerospace = useCallback((nextMode) => {
    if (aeroTimers.current.length) return

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      switchMode(nextMode, { scroll: false })
      return
    }

    const direction = nextMode === 'register'
      ? 'outbound'
      : 'inbound'

    setAeroFlight({ direction, phase: 'depart' })

    aeroTimers.current = [
      window.setTimeout(() => {
        switchMode(nextMode, { scroll: false })
        setAeroFlight({ direction, phase: 'arrive' })
      }, 300),

      window.setTimeout(() => {
        setAeroFlight(null)
        aeroTimers.current = []
      }, 1080),
    ]
  }, [switchMode])

  useEffect(() => {
    captureReferralFromUrl()
  }, [])

  const [previousInitialMode, setPreviousInitialMode] =
    useState(initialMode)

  if (previousInitialMode !== initialMode) {
    setPreviousInitialMode(initialMode)
    setMode(initialMode)
  }

  useEffect(() => {
    if (
      mode !==
      'verify'
    ) {
      return undefined
    }

    if (
      otpSeconds <= 0
    ) {
      return undefined
    }

    const timer =
      window.setInterval(
        () => {
          setOtpSeconds(
            (current) =>
              Math.max(
                0,
                current -
                  1,
              ),
          )
        },
        1000,
      )

    return () =>
      window.clearInterval(
        timer,
      )
  }, [
    mode,
    otpSeconds,
  ])

  const applyLandingSnapshot =
    useCallback(
      (
        payload = {},
      ) => {
        setFeed(
          normalizeFeed(
            payload,
          ),
        )

      },
      [],
    )

  const loadLandingFeed =
    useCallback(
      async () => {
        try {
          const {
            response,
            data,
          } =
            await publicJson(
              '/api/public/landing-feed?limit=24',
              {
                method:
                  'GET',
                cache:
                  'no-store',
              },
            )

          if (
            response.ok &&
            data?.success
          ) {
            applyLandingSnapshot(
              data,
            )
          }
        } catch {
          // Preserve last successful snapshot.
        }
      },
      [
        applyLandingSnapshot,
      ],
    )

  useEffect(() => {
    const initialFeedTimer = window.setTimeout(() => {
      void loadLandingFeed()
    }, 0)

    const timer =
      window.setInterval(
        loadLandingFeed,
        8000,
      )

    let socket = null

    try {
      const base =
        getPublicApiBase()

      const endpoint =
        base
          ? `${base}/public-landing`
          : '/public-landing'

      socket =
        io(
          endpoint,
          {
            transports: [
              'websocket',
              'polling',
            ],
          },
        )

      socket.on(
        'connect',
        () =>
          setLiveConnected(
            true,
          ),
      )

      socket.on(
        'disconnect',
        () =>
          setLiveConnected(
            false,
          ),
      )

      socket.on(
        'landingSnapshot',
        (
          payload,
        ) => {
          if (
            payload?.success
          ) {
            applyLandingSnapshot(
              payload,
            )
          }
        },
      )
    } catch {
      socket = null
    }

    return () => {
      window.clearTimeout(initialFeedTimer)
      window.clearInterval(
        timer,
      )

      socket?.disconnect?.()
    }
  }, [
    applyLandingSnapshot,
    loadLandingFeed,
  ])

  const formattedOtpTime =
    useMemo(
      () => {
        const minutes =
          Math.floor(
            otpSeconds /
              60,
          )

        const seconds =
          otpSeconds %
          60

        return `${String(
          minutes,
        ).padStart(
          2,
          '0',
        )}:${String(
          seconds,
        ).padStart(
          2,
          '0',
        )}`
      },
      [otpSeconds],
    )

  const finishAuth =
    useCallback(
      (
        result,
        fallbackEmail = '',
      ) => {
        clearPendingVerifyEmail()
        clearFreshAuthState()

        persistClientSession(
          {
            ...(result.user ||
              {}),
            email:
              result.user
                ?.email ||
              fallbackEmail,
          },
          result.token,
        )

        try {
          sessionStorage.setItem(
            POST_LOGIN_KEY,
            '1',
          )
        } catch { /* Optional browser operation; failure is non-fatal. */ }

        setPostLogin(
          true,
        )

        window.setTimeout(
          () => {
            const redirect = new URLSearchParams(
              window.location.search
            ).get('redirect')?.trim().toLowerCase()

            const destination = redirect === 'plaza'
              ? '/plaza'
              : '/dashboard'

            window.location.assign(
              `${destination}?auth=${Date.now()}`,
            )
          },
          450,
        )
      },
      [],
    )

  const handleDeleted =
    useCallback(
      (
        response,
        result,
        email = '',
      ) => {
        if (
          !isDeletedAccountResult(
            response,
            result,
          )
        ) {
          return false
        }

        clearPendingVerifyEmail()
        clearFreshAuthState()

        setRegister(
          (current) => ({
            ...current,
            email:
              clean(
                email,
              ).toLowerCase(),
          }),
        )

        setResetEmail('')
        setResetOtp('')

        setMode(
          'register',
        )

        showToast(
          result?.message ||
            'This account has been deleted. Please register again.',
          'error',
        )

        return true
      },
      [showToast],
    )

  const submitLogin =
    async (
      event,
    ) => {
      event.preventDefault()

      const raw =
        clean(
          login.identifier,
        )

      const identifier =
        (
          raw.includes('@') &&
          !raw.startsWith('@')
        )
          ? raw.toLowerCase()
          : raw
              .replace(
                /^@+/,
                '',
              )
              .toLowerCase()

      if (
        !identifier ||
        !login.password
      ) {
        showToast(
          'Please enter your email/username and password.',
          'error',
        )
        return
      }

      setBusy(
        'login',
      )

      try {
        const {
          response,
          data,
        } =
          await publicJson(
            '/api/login',
            {
              method:
                'POST',
              body:
                JSON.stringify({
                  identifier,
                  password:
                    login.password,
                }),
            },
          )

        if (
          data?.success
        ) {
          showToast(
            data.message ||
              'Login successful.',
          )

          finishAuth(
            data,
            data.user
              ?.email ||
              (
                identifier.includes(
                  '@',
                )
                  ? identifier
                  : ''
              ),
          )

          return
        }

        if (
          handleDeleted(
            response,
            data,
            identifier,
          )
        ) {
          return
        }

        if (
          response.status ===
            403 &&
          data?.verificationRequired
        ) {
          const email =
            clean(
              data.email ||
                identifier,
            ).toLowerCase()

          setPendingVerifyEmail(
            email,
          )

          if (
            data.otpSent !==
            true &&
            email
          ) {
            try {
              await publicJson(
                '/api/resend-otp',
                {
                  method:
                    'POST',
                  body:
                    JSON.stringify({
                      email,
                    }),
                },
              )
            } catch { /* Optional browser operation; failure is non-fatal. */ }
          }

          setOtp('')
          setOtpSeconds(
            120,
          )
          setMode(
            'verify',
          )

          showToast(
            data.message ||
              'Verification code sent to your email.',
            data.otpSent ===
            false
              ? 'error'
              : 'success',
          )

          return
        }

        showToast(
          data?.message ||
            'Unable to log in.',
          'error',
        )
      } catch {
        showToast(
          'Server error during login.',
          'error',
        )
      } finally {
        setBusy('')
      }
    }

  const chooseAvatar =
    (
      event,
    ) => {
      const file =
        event.target
          .files?.[0]

      if (!file) {
        return
      }

      if (
        !file.type.startsWith(
          'image/',
        )
      ) {
        showToast(
          'Please upload a valid image file.',
          'error',
        )
        return
      }

      const reader =
        new FileReader()

      reader.onload =
        () => {
          setCropSource(
            String(
              reader.result ||
                '',
            ),
          )
        }

      reader.onerror =
        () => {
          showToast(
            'Unable to open this image.',
            'error',
          )
        }

      reader.readAsDataURL(
        file,
      )
    }

  const applyCrop =
    async (
      crop,
    ) => {
      try {
        const result =
          await cropSquare(
            cropSource,
            crop,
          )

        setCroppedAvatar(
          result,
        )

        setCropSource('')
      } catch (
        error
      ) {
        showToast(
          error?.message ||
            'Unable to crop this image.',
          'error',
        )
      }
    }

  const submitRegister =
    async (
      event,
    ) => {
      event.preventDefault()

      const fullName =
        clean(
          register.fullName,
        )

      const email =
        clean(
          register.email,
        ).toLowerCase()

      const username =
        clean(
          register.username,
        )

      const city =
        clean(
          register.city,
        )

      const country =
        clean(
          register.country,
        )

      if (!fullName) {
        showToast(
          'Please enter your full name.',
          'error',
        )
        return
      }

      if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email,
        )
      ) {
        showToast(
          'Please enter a valid email address.',
          'error',
        )
        return
      }

      if (!username) {
        showToast(
          'Please enter a username.',
          'error',
        )
        return
      }

      if (
        !city ||
        !country
      ) {
        showToast(
          'Please enter your city and country.',
          'error',
        )
        return
      }

      if (!croppedAvatar) {
        showToast(
          'Profile photo is required. Choose and crop a photo first.',
          'error',
        )
        return
      }

      if (
        !register.password
      ) {
        showToast(
          'Please create a password.',
          'error',
        )
        return
      }

      if (
        register.password !==
        register.confirmPassword
      ) {
        showToast(
          'Passwords do not match.',
          'error',
        )
        return
      }

      setBusy(
        'register',
      )

      try {
        const {
          data,
        } =
          await publicJson(
            '/api/register',
            {
              method:
                'POST',
              body:
                JSON.stringify({
                  fullName,
                  email,
                  username,
                  city,
                  country,
                  password:
                    register.password,
                  profilePhotoDataUrl:
                    croppedAvatar,
                  referralCode:
                    getReferralCode(),
                }),
            },
          )

        if (
          data?.success
        ) {
          const verificationEmail =
            clean(
              data.email ||
                email,
            ).toLowerCase()

          try {
            sessionStorage.setItem(
              'yh_pending_profile_avatar',
              croppedAvatar,
            )

            localStorage.setItem(
              'yh_pending_profile_avatar',
              croppedAvatar,
            )
          } catch { /* Optional browser operation; failure is non-fatal. */ }

          setPendingVerifyEmail(
            verificationEmail,
          )

          clearReferralCode()

          setRegister(
            EMPTY_REGISTER,
          )

          setCroppedAvatar('')
          setOtp('')
          setOtpSeconds(
            120,
          )
          setMode(
            'verify',
          )

          showToast(
            data.message ||
              'Verification code sent to your email.',
          )

          return
        }

        showToast(
          data?.message ||
            'Unable to create account.',
          'error',
        )
      } catch {
        showToast(
          'Server error during registration.',
          'error',
        )
      } finally {
        setBusy('')
      }
    }

  const resendOtp =
    async () => {
      const email =
        getPendingVerifyEmail()

      if (!email) {
        showToast(
          'Missing verification email. Please register again.',
          'error',
        )

        setMode(
          'register',
        )
        return
      }

      setBusy(
        'resend',
      )

      try {
        const {
          data,
        } =
          await publicJson(
            '/api/resend-otp',
            {
              method:
                'POST',
              body:
                JSON.stringify({
                  email,
                }),
            },
          )

        if (
          data?.success
        ) {
          setOtp('')
          setOtpSeconds(
            120,
          )

          showToast(
            'A new code has been sent to your email.',
          )
        } else {
          showToast(
            data?.message ||
              'Failed to resend code.',
            'error',
          )
        }
      } catch {
        showToast(
          'Failed to resend code.',
          'error',
        )
      } finally {
        setBusy('')
      }
    }

  const submitOtp =
    async (
      event,
    ) => {
      event.preventDefault()

      const email =
        getPendingVerifyEmail()

      if (!email) {
        showToast(
          'Missing verification email. Please register again.',
          'error',
        )

        setMode(
          'register',
        )
        return
      }

      if (
        otpSeconds <= 0
      ) {
        showToast(
          'This code has expired. Please request a new code.',
          'error',
        )
        return
      }

      setBusy(
        'verify',
      )

      try {
        const {
          response,
          data,
        } =
          await publicJson(
            '/api/verify-otp',
            {
              method:
                'POST',
              body:
                JSON.stringify({
                  email,
                  otpCode:
                    clean(
                      otp,
                    ),
                }),
            },
          )

        if (
          data?.success
        ) {
          showToast(
            'Account verified. Welcome to YH Universe.',
          )

          finishAuth(
            data,
            email,
          )

          return
        }

        if (
          handleDeleted(
            response,
            data,
            email,
          )
        ) {
          return
        }

        showToast(
          data?.message ||
            'Verification failed.',
          'error',
        )
      } catch {
        showToast(
          'Server error during verification.',
          'error',
        )
      } finally {
        setBusy('')
      }
    }

  const submitForgot =
    async (
      event,
    ) => {
      event.preventDefault()

      const email =
        clean(
          resetEmail,
        ).toLowerCase()

      if (!email) {
        showToast(
          'Enter your registered email address.',
          'error',
        )
        return
      }

      setBusy(
        'forgot',
      )

      try {
        const {
          response,
          data,
        } =
          await publicJson(
            '/api/forgot-password',
            {
              method:
                'POST',
              body:
                JSON.stringify({
                  email,
                }),
            },
          )

        if (
          data?.success
        ) {
          setResetOtp('')
          setMode(
            'forgot-verify',
          )

          showToast(
            data.message ||
              'Recovery code sent.',
          )

          return
        }

        if (
          handleDeleted(
            response,
            data,
            email,
          )
        ) {
          setResetEmail('')
          return
        }

        showToast(
          data?.message ||
            'Unable to send recovery code.',
          'error',
        )
      } catch {
        showToast(
          'Server error.',
          'error',
        )
      } finally {
        setBusy('')
      }
    }

  const submitForgotOtp =
    async (
      event,
    ) => {
      event.preventDefault()

      setBusy(
        'forgot-verify',
      )

      try {
        const {
          response,
          data,
        } =
          await publicJson(
            '/api/verify-forgot-otp',
            {
              method:
                'POST',
              body:
                JSON.stringify({
                  email:
                    resetEmail,
                  otpCode:
                    clean(
                      resetOtp,
                    ),
                }),
            },
          )

        if (
          data?.success
        ) {
          setMode(
            'reset',
          )

          showToast(
            data.message ||
              'Code verified.',
          )

          return
        }

        if (
          handleDeleted(
            response,
            data,
            resetEmail,
          )
        ) {
          setResetEmail('')
          setResetOtp('')
          return
        }

        showToast(
          data?.message ||
            'Invalid recovery code.',
          'error',
        )
      } catch {
        showToast(
          'Server error.',
          'error',
        )
      } finally {
        setBusy('')
      }
    }

  const submitReset =
    async (
      event,
    ) => {
      event.preventDefault()

      if (
        resetPassword.password !==
        resetPassword.confirm
      ) {
        showToast(
          'Passwords do not match.',
          'error',
        )
        return
      }

      setBusy(
        'reset',
      )

      try {
        const {
          response,
          data,
        } =
          await publicJson(
            '/api/reset-password',
            {
              method:
                'POST',
              body:
                JSON.stringify({
                  email:
                    resetEmail,
                  newPassword:
                    resetPassword.password,
                }),
            },
          )

        if (
          data?.success
        ) {
          setResetPassword({
            password: '',
            confirm: '',
          })

          setResetEmail('')
          setResetOtp('')

          setMode(
            'reset-done',
          )

          showToast(
            data.message ||
              'Password updated.',
          )

          return
        }

        if (
          handleDeleted(
            response,
            data,
            resetEmail,
          )
        ) {
          setResetEmail('')
          setResetOtp('')
          return
        }

        showToast(
          data?.message ||
            'Unable to update password.',
          'error',
        )
      } catch {
        showToast(
          'Server error.',
          'error',
        )
      } finally {
        setBusy('')
      }
    }


  return (
    <main
      id="yh-l09-page"
      className="yh-l09"
      data-yh-react-surface="landing-auth"
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {postLogin && (
        <div className="yh-react-login-transition" role="status">
          <div>
            <img src="/images/logo.png" alt="" />
            <h2>Entering Universe</h2>
            <p>Syncing your access and preparing your dashboard.</p>
            <span />
          </div>
        </div>
      )}

      {landingVisible ? (
        <div className="yh-l09-home" id="top">
          <div className="yh-l09-noise" aria-hidden="true" />
          <div className="yh-l09-stars" aria-hidden="true" />

          <header className="yh-l09-nav">
            <a
              href="#top"
              className="yh-l09-wordmark"
              aria-label="Young Hustlers Universe home"
            >
              <img src="/images/logo.png" alt="" />
              <span>
                <strong>YOUNG HUSTLERS</strong>
                <small>UNIVERSE</small>
              </span>
            </a>

            <nav className="yh-l09-nav-links">
              <a href="#mobile">Mobile</a>
              <a href="#divisions">Divisions</a>
              <button type="button" onClick={enterTerminal}>
                Access Terminal
              </button>
              <button
                type="button"
                className="yh-l09-outline"
                onClick={enterTerminal}
              >
                Sign in →
              </button>
            </nav>

            <button
              type="button"
              className="yh-l09-menu-toggle"
              aria-label="Toggle navigation"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(v => !v)}
            >
              {mobileMenuOpen ? '×' : '☰'}
            </button>

            {mobileMenuOpen && (
              <nav className="yh-l09-mobile-menu">
                <a href="#mobile" onClick={() => setMobileMenuOpen(false)}>
                  Mobile
                </a>
                <a href="#divisions" onClick={() => setMobileMenuOpen(false)}>
                  Divisions
                </a>
                <button type="button" onClick={enterTerminal}>
                  Sign in →
                </button>
              </nav>
            )}
          </header>

          <section className="yh-l09-hero">
            <div className="yh-l09-hero-grid">
              <div className="yh-l09-hero-copy">
                <div className="yh-l09-kicker">
                  <span className="yh-l09-dot" />
                  YOUNG HUSTLERS UNIVERSE
                </div>

                <h1>
                  The Future of <em>Global Networking</em>
                </h1>

                <p className="yh-l09-lead">
                  The old world ran on information.
                  <br />
                  The next one runs on trust, access, and verified people.
                </p>

                <p className="yh-l09-body-copy">
                  Young Hustlers is a global organization built for
                  trusted access, verified connection, and real
                  opportunity across borders.
                </p>

                <div className="yh-l09-hero-actions">
                  <button
                    type="button"
                    className="yh-l09-primary"
                    onClick={enterTerminal}
                  >
                    Access Terminal →
                  </button>
                  <a href="#divisions">▷ Explore divisions</a>
                </div>

                <div className="yh-l09-trust">
                  <span>✧ Trusted access</span>
                  <span>◎ Verified connection</span>
                </div>
              </div>

              <div className="yh-l09-orbit-stage">
                <div className="yh-l09-orbit-glow" />
                <div className="yh-l09-orbit yh-l09-orbit-a" />
                <div className="yh-l09-orbit yh-l09-orbit-b" />

                <div className="yh-l09-orbit-core">
                  <div className="yh-l09-core-ring" />
                  <img
                    src="/images/logo.png"
                    alt="Young Hustlers Universe"
                  />
                </div>

                <div className="yh-l09-orbit-label yh-l09-node-a">
                  ✦ Academy
                </div>
                <div className="yh-l09-orbit-label yh-l09-node-b">
                  ◇ Plazas
                </div>
                <div className="yh-l09-orbit-label yh-l09-node-c">
                  ◈ Federation
                </div>

                <div className="yh-l09-signal">
                  <strong>Universe connection</strong>
                  <span>
                    {feed.some(
                      item => !String(item.id || '').startsWith(
                        'academy_live_placeholder_'
                      )
                    )
                      ? 'Live activity connected'
                      : 'Ready to connect'}
                  </span>
                </div>
              </div>
            </div>

            <a href="#activity" className="yh-l09-scroll">
              SCROLL TO EXPLORE ↓
            </a>
          </section>

          <section id="activity" className="yh-l09-section">
            <div className="yh-l09-container">
              <div className="yh-l09-kicker">
                PUBLIC UNIVERSE ACTIVITY
              </div>
              <h2>Latest verified activity</h2>
              <p>Updates from the YHU public activity service.</p>

              {feed.filter(
                item => !String(item.id || '').startsWith(
                  'academy_live_placeholder_'
                )
              ).length ? (
                <div className="yh-l09-feed-grid">
                  {feed
                    .filter(
                      item => !String(item.id || '').startsWith(
                        'academy_live_placeholder_'
                      )
                    )
                    .slice(0, 6)
                    .map((item, index) => (
                      <article key={item.id || index}>
                        <small>{item.label}</small>
                        <p>{item.feedText}</p>
                        <span>{item.locationText}</span>
                      </article>
                    ))}
                </div>
              ) : (
                <p>No recent public activity.</p>
              )}
            </div>
          </section>

          <section id="divisions" className="yh-l09-section">
            <div className="yh-l09-container">
              <div className="yh-l09-kicker">
                02 / CHOOSE YOUR DIRECTION
              </div>
              <h2>
                Three spaces. <em>One upward trajectory.</em>
              </h2>

              <div className="yh-l09-divisions-grid">
                {[
                  {
                    number: '01',
                    name: 'Academy',
                    kicker: 'Find your opportunities',
                    icon: '/images/academy%20icon.png',
                    text: 'Find jobs and opportunities, build your roadmap through AI-guided missions, enter a like-minded community, track execution, and step into live sessions.',
                  },
                  {
                    number: '02',
                    name: 'Plazas',
                    kicker: 'The marketplace layer',
                    icon: '/images/plaza%20icon.png',
                    text: 'The marketplace layer of Young Hustlers. Skills, services, offers, talent, and monetization pathways already connect through the dashboard.',
                  },
                  {
                    number: '03',
                    name: 'Federation',
                    kicker: 'The strategic network layer',
                    icon: '/images/federation%20icon.png',
                    text: 'The strategic network layer for high-value contacts, leverage, and long-term relationship capital is now available through the dashboard.',
                  },
                ].map((d, i) => (
                  <button
                    type="button"
                    key={d.number}
                    className={
                      'yh-l09-division' +
                      (i === activeDivision ? ' is-selected' : '')
                    }
                    onClick={() => setActiveDivision(i)}
                  >
                    <span className="yh-l09-division-top">
                      <small>{d.number}</small>
                      <img src={d.icon} alt="" />
                    </span>
                    <span className="yh-l09-division-body">
                      <small>{d.kicker}</small>
                      <strong>{d.name}</strong>
                      <span>{d.text}</span>
                      <b>Select space →</b>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="yh-l09-section yh-l09-cta">
            <div className="yh-l09-container">
              <div className="yh-l09-kicker">
                ACCESS YOUR PASSPORT INTO THE YOUNG HUSTLERS UNIVERSE
              </div>
              <h2>
                Access your passport into the{' '}
                <em>Young Hustlers Universe</em>
              </h2>
              <p>
                Log in to continue your mission or create an account
                to enter the Academy, Plazas, and Federation through
                the dashboard.
              </p>
              <button
                type="button"
                className="yh-l09-primary"
                onClick={enterTerminal}
              >
                Access Terminal →
              </button>
            </div>
          </section>

          <section
            id="mobile"
            className="yh-l09-section yh-l09-mobile"
          >
            <div className="yh-l09-container yh-l09-mobile-grid">
              <div>
                <div className="yh-l09-kicker">
                  YOUNG HUSTLERS IS READY ON MOBILE
                </div>
                <h2>
                  Your universe, <em>wherever you are.</em>
                </h2>
                <p>
                  Explore Young Hustlers on this website.
                  Official mobile application download links will
                  be shown here when verified.
                </p>

                <div className="yh-l09-mobile-status">
                  <div
                    className="yh-l09-store-badge"
                    aria-label="Google Play download coming soon"
                  >
                    <svg viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#21C064" d="M7 4 L28 24 L7 44 Z"/>
                      <path fill="#24C7EF" d="M7 4 L28 24 L37 15 Z"/>
                      <path fill="#F8CE40"
                        d="M28 24 L37 15 L44 21 Q47 24 44 27 L37 33 Z"/>
                      <path fill="#F85E64" d="M7 44 L28 24 L37 33 Z"/>
                    </svg>
                    <span className="yh-l09-store-copy">
                      <small>GET IT ON</small>
                      <strong>Google Play</strong>
                    </span>
                  </div>

                  <div
                    className="yh-l09-store-badge"
                    aria-label="App Store download coming soon"
                  >
                    <svg viewBox="0 0 24 24"
                      fill="currentColor" aria-hidden="true">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.12.35-1.13-.47-2.17-.5-3.36 0-1.49.63-2.28.45-3.18-.35C2.29 15.03 3.05 7.03 8.87 6.74c1.42.07 2.41.78 3.24.84 1.24-.25 2.42-.98 3.75-.89 1.6.13 2.8.77 3.6 1.93-3.28 1.96-2.5 6.29.5 7.47-.6 1.5-1.38 2.98-2.91 4.2ZM12.03 6.64c-.15-2.23 1.66-4.07 3.74-4.25.29 2.56-2.32 4.46-3.74 4.25Z"/>
                    </svg>
                    <span className="yh-l09-store-copy">
                      <small>Download on the</small>
                      <strong>App Store</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="yh-l09-phone">
                <div>
                  <img
                    src="/images/logo.png"
                    alt="Young Hustlers Universe"
                  />
                  <span>YOUNG HUSTLERS</span>
                </div>
              </div>
            </div>
          </section>

          <footer className="yh-l09-footer">
            <div className="yh-l09-container">
              <a href="#top" className="yh-l09-wordmark">
                <img src="/images/logo.png" alt="" />
                <span>
                  <strong>YOUNG HUSTLERS</strong>
                  <small>UNIVERSE</small>
                </span>
              </a>
              <span>YOUNG HUSTLERS UNIVERSE</span>
              <span>© 2026 Young Hustlers Universe</span>
              <nav>
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms</a>
              </nav>
            </div>
          </footer>
        </div>
      ) : (
        <div className="yh-l09-auth-screen"
          data-yh-aero-phase={aeroFlight?.phase || 'idle'}
          data-yh-aero-direction={aeroFlight?.direction || 'outbound'}>
          <div className="yh-l09-auth-bg" aria-hidden="true" />

          <div className="yh-l10-cosmos" aria-hidden="true">
            <span className="yh-l10-aurora yh-l10-aurora-one" />
            <span className="yh-l10-aurora yh-l10-aurora-two" />
            <span className="yh-l10-orbit yh-l10-orbit-one" />
            <span className="yh-l10-orbit yh-l10-orbit-two" />
            <span className="yh-l10-particles" />
          </div>
          <div className="yh-l11-craft-dock" aria-hidden="true">
            <YhuAerospaceCraft />
          </div>

          {aeroFlight && (
            <div className="yh-l11-flight-layer"
              data-direction={aeroFlight.direction}
              aria-hidden="true">
              <div className="yh-l11-flight-beam" />
              <div className="yh-l11-portal"><span /></div>
              <div className="yh-l11-ship-run">
                <YhuAerospaceCraft />
              </div>
            </div>
          )}

          {mode === 'login' && (
          <div className="yh-l09-auth-center" ref={authRef}>
            <button
              className="yh-l09-back"
              type="button"
              onClick={() => {
                if (window.location.pathname === '/') {
                  setLandingVisible(true)
                } else {
                  window.location.assign('/')
                }
              }}
            >
              ← Back to home
            </button>

            {/* YHU_L10_CUSTOM_TERMINAL */}
            <section className="yh-l09-login-card">
              <div className="yh-l09-login-head">
                <img
                  src="/images/logo.png"
                  alt="Young Hustlers Universe"
                />
                <h1>Access Terminal</h1>
                <p>Secure entry to your divisions</p>
              </div>

              <form
                onSubmit={submitLogin}
                className="yh-l09-login-form"
              >
                <label>
                  <span>Email or username</span>
                  <div className="yh-l09-input-shell">
                    <span aria-hidden="true" className="yh-l10-input-icon">
                      <svg viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="3"/>
                        <path d="m4 7 8 6 8-6"/>
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={login.identifier}
                      placeholder="you@example.com"
                      autoComplete="username"
                      required
                      onChange={e =>
                        setLogin(c => ({
                          ...c,
                          identifier: e.target.value,
                        }))
                      }
                    />
                  </div>
                </label>

                <label>
                  <span>Password</span>
                  <div className="yh-l09-input-shell">
                    <span aria-hidden="true" className="yh-l10-input-icon">
                      <svg viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="11" width="16" height="10" rx="2"/>
                        <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                      </svg>
                    </span>
                    <PasswordField
                      inputClassName="yh-l09-password"
                      value={login.password}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      onChange={e =>
                        setLogin(c => ({
                          ...c,
                          password: e.target.value,
                        }))
                      }
                    />
                  </div>
                </label>

                <div className="yh-l09-forgot-row">
                  <button
                    type="button"
                    onClick={() =>
                      switchMode('forgot', { scroll: false })
                    }
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  className="yh-l09-signin"
                  disabled={busy === 'login'}
                >
                  {busy === 'login' ? 'Signing in...' : 'Sign In →'}
                </button>
              </form>

              <p className="yh-l09-login-footer">
                No account yet?{' '}
                <button
                  type="button"
                  onClick={() =>
                    navigateAerospace('register')
                  }
                >
                  Create your passport
                </button>
              </p>
            </section>
          </div>
          )}
          {/* YHU_L10_FIX2_SINGLE_VIEW */}
      {mode === 'register' && (
        <div
          className="yh-l10-signup-stage"
          aria-labelledby="yh-register-title"
        >
          <div className="yh-l10-signup-card">
            <button
              type="button"
              id="btn-flip-login"
              className="btn-back-icon auth-stop-propagation"
              aria-label="Close create account form"
              onClick={() => navigateAerospace('login')}
            >
              ×
            </button>
            <form id="form-register-simple" className="w-full yh-register-form"
              onSubmit={
                submitRegister
              }
            >
<div className="text-center mb-large mt-small">
    <img src="/images/logo.png" alt="YH Logo" className="step1-logo" />
    <h1 id="yh-register-title" className="main-title step1-title">
      YOUNG HUSTLERS UNIVERSE
    </h1>
    <p className="subtitle step1-subtitle">
      Create your passport to access all divisions.
    </p>
  </div>
                <div className="yh-react-form-grid">
                <label className="form-group w-full">
                  <span>
                    Full Name
                  </span>

                  <input
                    className="input-field"
                    value={
                      register.fullName
                    }
                    placeholder="e.g. John Doe"
                    autoComplete="name"
                    onChange={(
                      event,
                    ) =>
                      setRegister(
                        (
                          current,
                        ) => ({
                          ...current,
                          fullName:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label className="form-group w-full">
                  <span>
                    Email Address
                  </span>

                  <input
                    className="input-field"
                    type="email"
                    value={
                      register.email
                    }
                    placeholder="you@email.com"
                    autoComplete="email"
                    onChange={(
                      event,
                    ) =>
                      setRegister(
                        (
                          current,
                        ) => ({
                          ...current,
                          email:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label className="form-group w-full yh-react-form-span">
                  <span>
                    Username
                  </span>

                  <input
                    className="input-field"
                    value={
                      register.username
                    }
                    placeholder="Choose a username"
                    autoComplete="username"
                    onChange={(
                      event,
                    ) =>
                      setRegister(
                        (
                          current,
                        ) => ({
                          ...current,
                          username:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label className="form-group w-full">
                  <span>
                    City
                  </span>

                  <input
                    className="input-field"
                    value={
                      register.city
                    }
                    placeholder="e.g. Málaga"
                    autoComplete="address-level2"
                    onChange={(
                      event,
                    ) =>
                      setRegister(
                        (
                          current,
                        ) => ({
                          ...current,
                          city:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label className="form-group w-full">
                  <span>
                    Country
                  </span>

                  <input
                    className="input-field"
                    value={
                      register.country
                    }
                    placeholder="e.g. Spain"
                    autoComplete="country-name"
                    onChange={(
                      event,
                    ) =>
                      setRegister(
                        (
                          current,
                        ) => ({
                          ...current,
                          country:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label className="form-group w-full yh-react-form-span">
                  <span>
                    Profile Photo
                  </span>

                  <div className="yh-react-avatar-picker">
                    {croppedAvatar && (
                      <img
                        src={
                          croppedAvatar
                        }
                        alt="Profile preview"
                      />
                    )}

                    <input
                      type="file"
                      accept="image/*"
                      onChange={
                        chooseAvatar
                      }
                    />

                    {croppedAvatar && (
                      <button
                        type="button"
                        onClick={() =>
                          setCropSource(
                            croppedAvatar,
                          )
                        }
                      >
                        Adjust crop
                      </button>
                    )}
                  </div>

                  <small>
                    Required. JPG,
                    PNG and WEBP
                    accepted.
                  </small>
                </label>

                <label className="form-group w-full">
                  <span>
                    Create Password
                  </span>

                  <PasswordField
                  inputClassName="input-field yh-password-input"
                    value={
                      register.password
                    }
                    placeholder="••••••••"
                    autoComplete="new-password"
                    onChange={(
                      event,
                    ) =>
                      setRegister(
                        (
                          current,
                        ) => ({
                          ...current,
                          password:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label className="form-group w-full">
                  <span>
                    Confirm Password
                  </span>

                  <PasswordField
                  inputClassName="input-field yh-password-input"
                    value={
                      register.confirmPassword
                    }
                    placeholder="••••••••"
                    autoComplete="new-password"
                    onChange={(
                      event,
                    ) =>
                      setRegister(
                        (
                          current,
                        ) => ({
                          ...current,
                          confirmPassword:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </label>
              </div>

              <button
                type="submit"
                className="btn-primary btn-large"
                disabled={
                  busy ===
                  'register'
                }
              >
                {busy ===
                'register'
                  ? 'Creating Account...'
                  : 'Create Account ➔'}
              </button>
            </form>
          </div>
        </div>
      )}
        </div>
      )}
      {Object.hasOwn({"verify":"step-2","forgot":"step-3","forgot-verify":"step-4","reset":"step-5","reset-done":"step-6"}, mode) && createPortal(
        <div
          id={{"verify":"step-2","forgot":"step-3","forgot-verify":"step-4","reset":"step-5","reset-done":"step-6"}[mode]}
          className={
            'step-container fade-in' +
            (mode === 'verify' ? ' yh-account-verify-modal-panel' : '')
          }
          role="dialog"
          aria-modal="true"
          aria-label="Account access"
        >
          <div
            className={
              mode === 'verify'
                ? 'yh-account-verify-card yh-react-auth-card'
                : 'card text-center py-large yh-react-auth-card'
            }
          >
            {mode === 'verify' && (
              <button
                type="button"
                className="yh-account-verify-close"
                aria-label="Back to login"
                onClick={() => switchMode('login', { scroll: false })}
              >
                ×
              </button>
            )}

            {mode ===
            'verify' && (
            <form id="form-verify-otp" className="w-full yh-account-verify-form"
              onSubmit={
                submitOtp
              }
            >
              <div className="yh-account-verify-head text-center">
      <img
        src="/images/logo.png"
        alt="YH Logo"
        className="yh-account-verify-logo"
      />
      <h1
        id="yh-account-verify-title"
        className="main-title step1-title"
      >
        YOUNG HUSTLERS UNIVERSE
      </h1>
      <p className="subtitle step1-subtitle">
        Enter the verification code sent to your email.
      </p>
    </div>

    <label className="form-group w-full">
                <span>
                  Verification Code
                </span>

                <input
                  id="otp-input" className="input-field yh-account-verify-input"
                  value={otp}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="••••••"
                  disabled={
                    otpSeconds <=
                    0
                  }
                  onChange={(
                    event,
                  ) =>
                    setOtp(
                      event.target
                        .value
                        .replace(
                          /\D+/g,
                          '',
                        )
                        .slice(
                          0,
                          6,
                        ),
                    )
                  }
                />
              </label>

              <div
                className={
                  'yh-react-otp-time yh-account-verify-timer ' +
                  (
                    otpSeconds <=
                    0
                      ? 'is-expired'
                      : ''
                  )
                }
              >
                {
                  formattedOtpTime
                }
              </div>

              {otpSeconds <=
                0 && (
                <p className="yh-otp-expiry-message">
                  This code has
                  expired. Please
                  request a new
                  code.
                </p>
              )}

              <button
                type="submit"
                id="btn-verify-otp" className="btn-primary btn-large yh-account-verify-submit"
                disabled={
                  busy ===
                    'verify' ||
                  otpSeconds <=
                    0
                }
              >
                {busy ===
                'verify'
                  ? 'Verifying...'
                  : 'Verify & Enter Universe ➔'}
              </button>

              <button
                type="button"
                id="btn-resend-otp" className="btn-resend"
                disabled={busy === 'resend' || otpSeconds > 0}
                onClick={() =>
                  void resendOtp()
                }
              >
                {busy ===
                'resend'
                  ? 'Sending...'
                  : otpSeconds > 0 ? ('Resend in ' + formattedOtpTime) : 'Resend Code'}
              </button>
            </form>
          )}

          {mode ===
            'forgot' && (
            <form
              onSubmit={
                submitForgot
              }
            >
              <div className="yh-react-auth-head">
                <div>
                  <h3>
                    Reset Password
                  </h3>

                  <p>
                    Enter your
                    registered
                    email to
                    receive a
                    recovery code.
                  </p>
                </div>
              </div>

              <label>
                <span>
                  Email Address
                </span>

                <input
                  type="email"
                  value={
                    resetEmail
                  }
                  placeholder="you@email.com"
                  autoComplete="email"
                  onChange={(
                    event,
                  ) =>
                    setResetEmail(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <button
                type="submit"
                className="yh-react-btn-primary yh-react-btn-full"
                disabled={
                  busy ===
                  'forgot'
                }
              >
                {busy ===
                'forgot'
                  ? 'Sending...'
                  : 'Send Recovery Code'}
              </button>

              <button
                type="button"
                className="yh-react-btn-secondary yh-react-btn-full"
                onClick={() =>
                  setMode(
                    'login',
                  )
                }
              >
                Cancel & Back to
                Login
              </button>
            </form>
          )}

          {mode ===
            'forgot-verify' && (
            <form
              onSubmit={
                submitForgotOtp
              }
            >
              <div className="yh-react-auth-head">
                <div>
                  <h3>
                    Verify Reset Code
                  </h3>

                  <p>
                    Enter the
                    recovery code
                    sent to your
                    email.
                  </p>
                </div>
              </div>

              <label>
                <span>
                  Recovery Code
                </span>

                <input
                  className="yh-react-otp-input"
                  value={
                    resetOtp
                  }
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="••••••"
                  onChange={(
                    event,
                  ) =>
                    setResetOtp(
                      event.target
                        .value
                        .replace(
                          /\D+/g,
                          '',
                        )
                        .slice(
                          0,
                          6,
                        ),
                    )
                  }
                />
              </label>

              <button
                type="submit"
                className="yh-react-btn-primary yh-react-btn-full"
                disabled={
                  busy ===
                  'forgot-verify'
                }
              >
                {busy ===
                'forgot-verify'
                  ? 'Verifying...'
                  : 'Verify Code'}
              </button>

              <button
                type="button"
                className="yh-react-btn-secondary yh-react-btn-full"
                onClick={() =>
                  setMode(
                    'login',
                  )
                }
              >
                Cancel Request
              </button>
            </form>
          )}

          {mode ===
            'reset' && (
            <form
              onSubmit={
                submitReset
              }
            >
              <div className="yh-react-auth-head">
                <div>
                  <h3>
                    Create New
                    Password
                  </h3>

                  <p>
                    Choose your
                    new password.
                  </p>
                </div>
              </div>

              <label>
                <span>
                  New Password
                </span>

                <PasswordField
                  value={
                    resetPassword.password
                  }
                  placeholder="••••••••"
                  autoComplete="new-password"
                  onChange={(
                    event,
                  ) =>
                    setResetPassword(
                      (
                        current,
                      ) => ({
                        ...current,
                        password:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Confirm Password
                </span>

                <PasswordField
                  value={
                    resetPassword.confirm
                  }
                  placeholder="••••••••"
                  autoComplete="new-password"
                  onChange={(
                    event,
                  ) =>
                    setResetPassword(
                      (
                        current,
                      ) => ({
                        ...current,
                        confirm:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <button
                type="submit"
                className="yh-react-btn-primary yh-react-btn-full"
                disabled={
                  busy ===
                  'reset'
                }
              >
                {busy ===
                'reset'
                  ? 'Saving...'
                  : 'Save New Password ➔'}
              </button>
            </form>
          )}

          {mode ===
            'reset-done' && (
            <div className="yh-react-auth-success">
              <img
                src="/images/logo.png"
                alt=""
              />

              <h3>
                Password Updated
              </h3>

              <p>
                Your password has
                been changed. You
                can now log in.
              </p>

              <button
                type="button"
                className="yh-react-btn-primary yh-react-btn-full"
                onClick={() =>
                  setMode(
                    'login',
                  )
                }
              >
                Return to Login
              </button>
            </div>
          )}
          </div>
        </div>,
        document.body
      )}

      {cropSource && createPortal(
        <Cropper
          source={
            cropSource
          }
          onCancel={() =>
            setCropSource('')
          }
          onApply={
            applyCrop
          }
        />
      , document.body)}
    </main>
  )
}
