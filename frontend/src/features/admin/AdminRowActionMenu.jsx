import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'

export default function AdminRowActionMenu({
  children,
  label = 'Actions'
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const menuId = useId()

  const placeMenu = useCallback(() => {
    const anchor = triggerRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()

    const width = Math.min(
      280,
      Math.max(180, window.innerWidth - 24)
    )

    const left = Math.max(
      12,
      Math.min(
        rect.right - width,
        window.innerWidth - width - 12
      )
    )

    const below =
      window.innerHeight - rect.bottom - 16

    const above = rect.top - 16

    const placeAbove =
      below < 190 && above > below

    const maxHeight = Math.max(
      80,
      Math.min(
        350,
        (placeAbove ? above : below) - 8
      )
    )

    setPosition({
      left,
      top: placeAbove
        ? Math.max(12, rect.top - maxHeight - 8)
        : rect.bottom + 8,
      width,
      maxHeight
    })
  }, [])

  useEffect(() => {
    if (!open) return undefined

    placeMenu()

    const onPointer = event => {
      if (
        !triggerRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }

    const onKeyDown = event => {
      if (event.key !== 'Escape') return

      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }

    const onReposition = () => placeMenu()

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKeyDown)

    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)

    return () => {
      document.removeEventListener(
        'pointerdown', onPointer
      )
      document.removeEventListener(
        'keydown', onKeyDown
      )
      window.removeEventListener(
        'resize', onReposition
      )
      window.removeEventListener(
        'scroll', onReposition, true
      )
    }
  }, [open, placeMenu])

  return (
    <div className="admin-row-action-menu">
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="true"
        onClick={() => setOpen(value => !value)}
      >
        {label}
        <span aria-hidden="true">⌄</span>
      </button>

      {open && position && createPortal(
        <div
          id={menuId}
          ref={panelRef}
          role="group"
          aria-label={label}
          className="admin-row-action-list"
          style={{
            position: 'fixed',
            left: position.left,
            top: position.top,
            width: position.width,
            maxHeight: position.maxHeight,
            zIndex: 10050
          }}
          onClickCapture={event => {
            if (event.target.closest('button')) {
              setOpen(false)
            }
          }}
        >
          {children}
        </div>,
        document.body
      )}
    </div>
  )
}
