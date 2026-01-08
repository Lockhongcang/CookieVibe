import { Tooltip } from 'antd'

export default function CalendarDayCellHeader({
  dayNumberText,
  date,
  disableAddNote = false,
  disableAddBooking = false,
  onAddNote,
  onAddBooking
}) {
  return (
    <div className="cv-calendarDayHeader">
      <span className="cv-calendarDayNumber">{dayNumberText}</span>

      <Tooltip
        title={disableAddNote ? 'Đã đủ 1 note trong ngày' : 'Thêm note'}
        mouseEnterDelay={0.15}
      >
        <button
          type="button"
          disabled={disableAddNote}
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
            if (disableAddNote) return
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

      <Tooltip
        title={disableAddBooking ? 'Đã đủ 2 lịch chụp trong ngày' : 'Thêm lịch'}
        mouseEnterDelay={0.15}
      >
        <button
          type="button"
          disabled={disableAddBooking}
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
            if (disableAddBooking) return
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
