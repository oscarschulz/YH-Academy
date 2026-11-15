/* YHU_ACADEMY_FINAL_VISUAL_PARITY: original Announcements structure */
export default function AcademyAnnouncementsWorkspace() {
  return (
    <>
      <header className="chat-header">
        <div className="header-left">
          <span className="hash-big">📢</span>
          <h3>announcements</h3>
          <div className="header-divider" />
          <p className="header-topic">
            HQ Bulletins and Community Polls
          </p>
        </div>
      </header>

      <div className="chat-messages hide-scrollbar">
        <div id="dynamic-announcements-history">
          <div className="announcement-empty">
            No new announcements from HQ.
          </div>
        </div>
      </div>
    </>
  )
}
