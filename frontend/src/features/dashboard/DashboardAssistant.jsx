import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { apiFetch } from '../../services/api/apiClient'
import './DashboardAssistant.css'

const CONVERSATION_ID =
  'dashboard_ticket_main'

const WELCOME_MESSAGE =
  'What is your issue? Choose the closest category. You can report a bug, ask about access, or ask how Academy, Plazas, and Federation work.'

const CATEGORIES = [
  {
    value: 'general',
    label: 'General Support',
    hint: 'Use this if the issue does not fit a specific category.',
    prompt: 'Describe your issue, what you clicked, and what happened.',
  },
  {
    value: 'platform_guide',
    label: 'Platform Guide / Divisions',
    hint: 'Questions about what Academy, Plazas, or Federation does and how the three divisions work together.',
    prompt: 'Ask about Academy, Plazas, Federation, or how the YH Universe divisions work.',
  },
  {
    value: 'earning_paths',
    label: 'Earning / Money Paths',
    hint: 'Questions about Academy, Plazas, Federation, referrals, missions, opportunities, or deal rooms.',
    prompt: 'Tell us which earning path you need help with.',
  },
  {
    value: 'billing',
    label: 'Billing & Payments',
    hint: 'Payment problems, invoices, checkout, OxaPay, Stripe, failed payment, or billing questions.',
    prompt: 'Tell us the payment method, plan, amount, and what went wrong.',
  },
  {
    value: 'academy',
    label: 'Academy',
    hint: 'Roadmap, missions, Academy access, AI Coach, lessons, community feed, or application issues.',
    prompt: 'Tell us which Academy feature is affected.',
  },
  {
    value: 'federation',
    label: 'Federation',
    hint: 'Federation application, access, directory, deal rooms, networking, or YHF badge issues.',
    prompt: 'Tell us what Federation page or action is causing the issue.',
  },
  {
    value: 'plazas',
    label: 'Plazas',
    hint: 'Plaza access, Patron application, regional Plaza, marketplace, meetups, or profile issues.',
    prompt: 'Tell us which Plaza feature is affected and what result you expected.',
  },
  {
    value: 'profile',
    label: 'Profile / Edit Profile',
    hint: 'Avatar, cover photo, username, bio, skills, marketplace readiness, or profile save issues.',
    prompt: 'Tell us what profile field you changed and whether it saved.',
  },
  {
    value: 'login_account',
    label: 'Login / Account Access',
    hint: 'Login, OTP, password reset, session expiry, account access, or auth issues.',
    prompt: 'Tell us what login/account step failed and what message you saw.',
  },
  {
    value: 'subscriptions',
    label: 'Subscriptions / Unsubscribe',
    hint: 'Active subscription visibility, unsubscribe, renewal, cancellation, or plan status.',
    prompt: 'Tell us which subscription or badge plan you are managing.',
  },
  {
    value: 'verification_badge',
    label: 'Verification Badge',
    hint: 'YHA/YHF badge payment, activation, visibility, or verified status issues.',
    prompt: 'Tell us which badge is affected and what status you see.',
  },
  {
    value: 'messages',
    label: 'Messages / Business Chats',
    hint: 'Private messages, group chats, Business Chats, replies, unread states, or chat problems.',
    prompt: 'Tell us which conversation type is affected and what failed.',
  },
  {
    value: 'applications',
    label: 'Applications / Pending Approval',
    hint: 'Academy, Plaza, Federation applications, pending status, rejected status, or enter-button problems.',
    prompt: 'Tell us which application is affected and its current status.',
  },
  {
    value: 'technical_bug',
    label: 'Technical Bug / UI Issue',
    hint: 'Broken button, loader, visual glitch, console error, mobile layout, or unexpected behavior.',
    prompt: 'Describe the bug, device/browser, page, and steps to reproduce it.',
  },
  {
    value: 'uploads_media',
    label: 'Uploads / Media',
    hint: 'Image, avatar, cover, post media, video, or file upload issues.',
    prompt: 'Tell us what you uploaded and what happened.',
  },
  {
    value: 'referrals_commissions',
    label: 'Referrals / Commissions',
    hint: 'Referral code, invited users, payout, commission activity, or reward tracking issues.',
    prompt: 'Tell us which referral or commission item looks wrong.',
  },
  {
    value: 'other',
    label: 'Other',
    hint: 'Use this when none of the listed categories match.',
    prompt: 'Describe the issue clearly with any useful context.',
  },
]

function normalizeMessages(value) {
  return Array.isArray(value)
    ? value
    : []
}

function messageText(item = {}) {
  return String(
    item.text ||
      item.message ||
      item.content ||
      '',
  ).trim()
}

export default function DashboardAssistant({
  onToast,
}) {
  const [open, setOpen] =
    useState(false)

  const [messages, setMessages] =
    useState([])

  const [category, setCategory] =
    useState('general')

  const [text, setText] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [sending, setSending] =
    useState(false)

  const listRef =
    useRef(null)

  const activeCategory =
    useMemo(
      () =>
        CATEGORIES.find(
          (item) =>
            item.value === category,
        ) ||
        CATEGORIES[0],
      [category],
    )

  const loadMessages =
    async () => {
      setLoading(true)

      try {
        const result =
          await apiFetch(
            `/api/dashboard/assistant/messages?conversationId=${encodeURIComponent(
              CONVERSATION_ID,
            )}`,
            {
              method: 'GET',
              cache: 'no-store',
            },
          )

        const incoming =
          normalizeMessages(
            result?.messages,
          )

        setMessages(
          incoming.length
            ? incoming
            : [
                {
                  role: 'assistant',
                  text: WELCOME_MESSAGE,
                  createdAt:
                    new Date()
                      .toISOString(),
                },
              ],
        )
      } catch (error) {
        setMessages([
          {
            role: 'assistant',
            text:
              error?.message ||
              'Assistant history could not be loaded. You can still send a message.',
          },
        ])
      } finally {
        setLoading(false)
      }
    }

  useEffect(() => {
    if (!open) return undefined

    const initialLoad = window.setTimeout(() => {
      void loadMessages()
    }, 0)

    return () => window.clearTimeout(initialLoad)
  }, [open])

  useEffect(() => {
    if (!open) return

    listRef.current
      ?.scrollTo({
        top:
          listRef.current
            .scrollHeight,
        behavior: 'smooth',
      })
  }, [
    open,
    messages,
  ])

  const sendMessage =
    async () => {
      const cleanText =
        String(text || '').trim()

      if (
        !cleanText ||
        sending
      ) {
        return
      }

      const ticketMessage = [
        `Issue Category: ${activeCategory.label}`,
        `Issue Details: ${cleanText}`,
      ].join('\n')

      const existing =
        messages.filter(
          (item) =>
            item.__thinking !==
            true,
        )

      const userMessage = {
        role: 'user',
        text: ticketMessage,
        createdAt:
          new Date()
            .toISOString(),
      }

      setText('')
      setSending(true)

      setMessages([
        ...existing,
        userMessage,
        {
          role: 'assistant',
          text: 'Thinking...',
          __thinking: true,
          createdAt:
            new Date()
              .toISOString(),
        },
      ])

      try {
        const result =
          await apiFetch(
            '/api/dashboard/assistant/chat',
            {
              method: 'POST',

              body:
                JSON.stringify({
                  conversationId:
                    CONVERSATION_ID,

                  message:
                    ticketMessage,

                  ticketDetails:
                    cleanText,

                  issueCategory:
                    activeCategory
                      .value,

                  issueCategoryLabel:
                    activeCategory
                      .label,

                  contextHint:
                    `dashboard_ticket:${activeCategory.value}`,
                }),
            },
          )

        const ticket =
          result?.supportTicket &&
          typeof result
            .supportTicket ===
            'object'
            ? result.supportTicket
            : null

        if (ticket?.ticketCode) {
          onToast?.(
            `Support ticket ${ticket.ticketCode} ${ticket.created === true ? 'created.' : 'updated.'}`,
            'success',
          )
        }

        try {
          await loadMessages()
        } catch {
          setMessages([
            ...existing,
            userMessage,
            {
              role: 'assistant',
              text:
                result?.reply ||
                'Your message was received.',
            },
          ])
        }
      } catch (error) {
        setMessages([
          ...existing,
          userMessage,
          {
            role: 'assistant',
            text:
              error?.message ||
              'I could not send that message. Please try again.',
          },
        ])

        onToast?.(
          error?.message ||
            'Failed to send assistant message.',
          'error',
        )
      } finally {
        setSending(false)
      }
    }

  return (
    <>
      <button
        type="button"
        className="yh-dashboard-assistant-launcher"
        onClick={() =>
          setOpen(true)
        }
        aria-label="Open YH Dashboard Assistant"
      >
        <img
          src="/assets/yh-ai-robot-avatar.png?v=20260529-ai-robot-avatar-v1"
          alt=""
        />
        <span>Support</span>
      </button>

      {open && (
        <div
          className="yh-dashboard-assistant-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setOpen(false)
            }
          }}
        >
          <section
            className="yh-dashboard-assistant-panel"
            role="dialog"
            aria-modal="true"
            aria-label="YH Dashboard Assistant"
          >
            <header className="yh-dashboard-assistant-header">
              <div className="yh-dashboard-assistant-heading">
                <img
                  src="/assets/yh-ai-robot-avatar.png?v=20260529-ai-robot-avatar-v1"
                  alt=""
                />

                <div>
                  <small>
                    Support Ticket
                  </small>

                  <h2>
                    YH Dashboard Assistant
                  </h2>

                  <p>
                    Choose a category and explain the issue.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="yh-dashboard-assistant-close"
                onClick={() =>
                  setOpen(false)
                }
                aria-label="Close assistant"
              >
                ×
              </button>
            </header>

            <div className="yh-dashboard-assistant-intake">
              <label htmlFor="yh-dashboard-assistant-category">
                What is your issue?
              </label>

              <select
                id="yh-dashboard-assistant-category"
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target.value,
                  )
                }
              >
                {CATEGORIES.map(
                  (item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ),
                )}
              </select>

              <p>
                {activeCategory.hint}
              </p>
            </div>

            <div
              className="yh-dashboard-assistant-messages"
              ref={listRef}
            >
              {loading &&
              !messages.length ? (
                <div className="yh-dashboard-assistant-empty">
                  Loading assistant...
                </div>
              ) : (
                messages.map(
                  (item, index) => {
                    const role =
                      item.role ===
                      'user'
                        ? 'user'
                        : 'assistant'

                    return (
                      <div
                        key={
                          item.id ||
                          `${role}-${index}`
                        }
                        className={
                          `yh-dashboard-assistant-message is-${role}`
                        }
                      >
                        <strong>
                          {role ===
                          'user'
                            ? 'You'
                            : 'YH Assistant'}
                        </strong>

                        <div>
                          {messageText(
                            item,
                          )}
                        </div>
                      </div>
                    )
                  },
                )
              )}
            </div>

            <form
              className="yh-dashboard-assistant-form"
              onSubmit={(event) => {
                event.preventDefault()
                void sendMessage()
              }}
            >
              <textarea
                value={text}
                disabled={sending}
                placeholder={
                  activeCategory
                    .prompt
                }
                rows={3}
                onChange={(event) =>
                  setText(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                      'Enter' &&
                    !event.shiftKey
                  ) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
              />

              <button
                type="submit"
                disabled={
                  sending ||
                  !String(text)
                    .trim()
                }
              >
                {sending
                  ? 'Sending...'
                  : 'Send'}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
