import { Tooltip } from 'antd'

export default function CalendarDayCellHeader({
  dayNumberText,
  date,
  onAddNote,
  onAddBooking
}) {
  return (
    <div className="cv-calendarDayHeader">
      <span className="cv-calendarDayNumber">{dayNumberText}</span>

      <Tooltip title="Thêm note" mouseEnterDelay={0.15}>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onAddNote?.(date)
          }}
          aria-label="Thêm note"
          className="cv-calendarNoteBtn"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18, lineHeight: 1 }}>
            note_add
          </span>
        </button>
      </Tooltip>

      <Tooltip title="Thêm lịch" mouseEnterDelay={0.15}>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onAddBooking?.(date)
          }}
          aria-label="Thêm lịch"
          className="cv-calendarAddBtn"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18, lineHeight: 1 }}>
            calendar_add_on
          </span>
        </button>
      </Tooltip>
    </div>
  )
}
