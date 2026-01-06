import { Tooltip } from 'antd'
import dayjs from 'dayjs'

const BOOKING_STATUSES = new Set(['scheduled', 'completed', 'canceled', 'done'])

export default function CalendarEventContent({ info }) {
   const type = info?.event?.extendedProps?.type
   const time = info?.timeText
   const text = info?.event?.title

   const viewType = info?.view?.type
   const isTimeGrid = viewType === 'timeGridWeek' || viewType === 'timeGridDay'

   const start = info?.event?.start || null
   const end = info?.event?.end || null

   const timeRange = (() => {
      // Notes are rendered as all-day events (separate lane), so we must display time from raw note.
      if (type === 'note') {
         const raw = info?.event?.extendedProps?.raw
         const rawDate = raw?.date
         const rawTime = raw?.time
         if (rawDate && rawTime) return dayjs(`${rawDate}T${rawTime}`).format('HH:mm')
         return String(time || '').trim()
      }

      if (!start) return String(time || '').trim()
      const startText = dayjs(start).format('HH:mm')
      if (!end) return startText
      const endText = dayjs(end).format('HH:mm')
      return `${startText} - ${endText}`
   })()


   if (type === 'note') {
      const note = info?.event?.extendedProps?.raw || null
      const raw = String(note?.status || 'todo')
      const noteStatus = raw === 'completed' ? 'done' : 'todo'

      return (
         <Tooltip
            title={text}
            mouseEnterDelay={0.15}
         >
            <div
               className={`cv-eventRow note ${isTimeGrid ? 'cv-eventRow--stacked' : ''} ${noteStatus ? `status-${noteStatus}` : ''}`}
               data-cv-type="note"
               data-cv-status={noteStatus || 'todo'}
            >
               {isTimeGrid ? (
                  <>
                     <div className="cv-eventTop">
                        <span className="cv-eventTime">{timeRange}</span>
                     </div>
                     <div className="cv-eventText">{text}</div>
                  </>
               ) : (
                  <>
                     <span className="cv-eventTime">{timeRange || time}</span>
                     <span className="cv-eventText">{text}</span>
                  </>
               )}
            </div>
         </Tooltip>
      )
   }

   const bookingRaw = info?.event?.extendedProps?.raw || null
   const rawStatus = String(info?.event?.extendedProps?.displayStatus || bookingRaw?.status || 'scheduled')
   const bookingStatus = BOOKING_STATUSES.has(rawStatus) ? rawStatus : 'scheduled'


   return (
      <Tooltip
         title={text}
         mouseEnterDelay={0.15}
      >
         <div
            className={`cv-eventRow booking ${isTimeGrid ? 'cv-eventRow--stacked' : ''} status-${bookingStatus}`}
            data-cv-type="booking"
            data-cv-status={bookingStatus}
         >
            {isTimeGrid ? (
               <>
                  <div className="cv-eventTop">
                     <span className="cv-eventTime">{timeRange}</span>
                  </div>
                  <div className="cv-eventText">{text}</div>
               </>
            ) : (
               <>
                  <span className="cv-eventTime">{time}</span>
                  <span className="cv-eventText">{text}</span>
               </>
            )}
         </div>
      </Tooltip>
   )
}
