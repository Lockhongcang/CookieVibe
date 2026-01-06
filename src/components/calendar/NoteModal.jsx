import dayjs from 'dayjs'
import { Button, DatePicker, Input, Modal, Select, Space, TimePicker, Typography } from 'antd'
import { useMemo } from 'react'
import { toast } from 'react-toastify'

const timeStringToDayjs = (value) => {
  if (!value) return null
  const [hh, mm] = String(value).split(':').map((s) => Number(s))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return dayjs().hour(hh).minute(mm).second(0)
}

const dayjsToTimeString = (d) => {
  if (!d) return ''
  try {
    return dayjs(d).format('HH:mm')
  } catch {
    return ''
  }
}

const NOTE_STATUS_OPTIONS = [
  { value: 'todo', label: 'Todo' },
  { value: 'completed', label: 'Completed' },
]

export default function NoteModal({
  open,
  note,
  form,
  baseline,
  onChangeForm,
  onCancel,
  onOk,
  confirmLoading = false,
  readOnly = false
}) {
  const title = note?.id ? 'Chi tiết note' : 'Tạo note'
  const okText = note?.id ? 'Lưu ghi chú' : 'Tạo ghi chú'

  const isDirty = useMemo(() => {
    if (!open) return false
    if (!baseline) return false
    const current = {
      date: String(form?.date || ''),
      time: String(form?.time || ''),
      content: String(form?.content || ''),
      status: String(form?.status || 'todo')
    }
    return JSON.stringify(baseline) !== JSON.stringify(current)
  }, [baseline, form?.date, form?.time, form?.content, form?.status, open])

  const confirmDiscardIfDirty = async () => {
    if (readOnly) return true
    if (!isDirty) return true

    return await new Promise((resolve) => {
      Modal.confirm({
        title: 'Huỷ thay đổi?'
        , content: 'Bạn có thay đổi chưa lưu. Nếu huỷ, dữ liệu sẽ bị mất.'
        , icon: (
          <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
            warning
          </span>
        )
        , okText: 'Huỷ'
        , okButtonProps: { danger: true }
        , cancelText: 'Tiếp tục chỉnh'
        , onOk: () => resolve(true)
        , onCancel: () => resolve(false)
      })
    })
  }

  const handleOk = async () => {
    if (readOnly) return

    const date = String(form?.date || '').trim()
    const time = String(form?.time || '').trim()
    const content = String(form?.content || '').trim()

    if (!date) return toast.error('Vui lòng chọn ngày')
    if (!time) return toast.error('Vui lòng chọn giờ')
    if (!content) return toast.error('Vui lòng nhập nội dung note')

    onOk?.()
  }

  return (
    <Modal
      open={open}
      title={title}
      wrapClassName="cv-calendarModal"
      centered
      closeIcon={(
        <span className="material-symbols-rounded" style={{ fontSize: 22, lineHeight: 1 }}>
          close
        </span>
      )}
      onCancel={async () => {
        const ok = await confirmDiscardIfDirty()
        if (!ok) return
        onCancel?.()
      }}
      onOk={readOnly ? undefined : handleOk}
      okText={okText}
      confirmLoading={confirmLoading}
      cancelText={readOnly ? 'Đóng' : 'Huỷ'}
      footer={
        readOnly
          ? [
              <Button key="close" onClick={onCancel}>
                Đóng
              </Button>
            ]
          : undefined
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div className="cv-dateTimeBlock">
          <div className="cv-dateTimeLabel">Ngày & giờ</div>
          <DatePicker
            value={form?.date ? dayjs(form.date) : null}
            format="dddd, DD/MM/YYYY"
            allowClear={false}
            disabled
            inputReadOnly
            suffixIcon={(
              <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                calendar_month
              </span>
            )}
            style={{ width: '100%' }}
          />
          <div className="cv-timeSingleRow">
            <TimePicker
              value={timeStringToDayjs(form?.time)}
              onChange={(d) => onChangeForm?.((p) => ({ ...p, time: dayjsToTimeString(d) }))}
              format="HH:mm"
              allowClear={false}
              suffixIcon={(
                <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                  schedule
                </span>
              )}
              disabled={readOnly}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Trạng thái</div>
          <Select
            value={form?.status || 'todo'}
            onChange={(value) => onChangeForm?.((p) => ({ ...p, status: value }))}
            options={NOTE_STATUS_OPTIONS}
            disabled={readOnly}
            suffixIcon={(
              <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                expand_more
              </span>
            )}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Nội dung note</div>
          <div className="cv-textareaWithIcon">
            <span className="material-symbols-rounded cv-inputIcon" aria-hidden>
              edit_note
            </span>
            <Input.TextArea
              className="cv-textareaWithLeftIcon"
              rows={4}
              value={form?.content || ''}
              onChange={(e) => onChangeForm?.((p) => ({ ...p, content: e.target.value }))}
              placeholder="Nhập ghi chú…"
              disabled={readOnly}
            />
          </div>
          <Typography.Text type="secondary">Note sẽ hiển thị trên lịch theo giờ đã chọn.</Typography.Text>
        </div>
      </Space>
    </Modal>
  )
}
