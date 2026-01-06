import { Button, Card, Input, InputNumber, Modal, Space, Switch, Table, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { toNumber } from '../utils/number.js'
import { createPackage, deletePackage, getPackages, updatePackage } from '../services/package.service'
import '../styles/pages/packages.css'

const formatWithCommas = (value) => {
  if (value === null || value === undefined || value === '') return ''
  const raw = String(value)

  const sign = raw.startsWith('-') ? '-' : ''
  const unsigned = sign ? raw.slice(1) : raw
  const [intPart, decPart] = unsigned.split('.')
  const formattedInt = String(intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  if (decPart !== undefined && decPart !== '') return `${sign}${formattedInt}.${decPart}`
  return `${sign}${formattedInt}`
}

const parseCommas = (value) => {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/[,\s]/g, '')
    .replace(/[^\d.-]/g, '')
}

function PackagesPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const [isMobile, setIsMobile] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' | 'edit'
  const [activeRow, setActiveRow] = useState(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    price: 0,
    has_makeup: false,
    is_active: true
  })

  const [initialModalForm, setInitialModalForm] = useState(null)

  const isModalDirty = useMemo(() => {
    if (!modalOpen) return false
    const baseline = initialModalForm
    if (!baseline) return false
    const current = {
      name: String(form.name || '').trim(),
      price: toNumber(form.price),
      has_makeup: Boolean(form.has_makeup),
      is_active: Boolean(form.is_active)
    }
    return JSON.stringify(baseline) !== JSON.stringify(current)
  }, [modalOpen, form, initialModalForm])

  const fetchPackages = async () => {
    setLoading(true)
    const { data, error } = await getPackages()
    setLoading(false)

    if (error) {
      console.error(error)
      toast.error(error.message || 'Không tải được danh sách gói chụp')
      return
    }

    setRows(data || [])
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPackages()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 768px)')
    if (!mq) return

    const sync = () => setIsMobile(Boolean(mq.matches))
    sync()

    if (mq.addEventListener) mq.addEventListener('change', sync)
    else mq.addListener(sync)

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', sync)
      else mq.removeListener(sync)
    }
  }, [])

  const openCreate = () => {
    setModalMode('create')
    setActiveRow(null)
    setForm({
      name: '',
      price: 0,
      has_makeup: false,
      is_active: true
    })
    setInitialModalForm({
      name: '',
      price: 0,
      has_makeup: false,
      is_active: true
    })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setModalMode('edit')
    setActiveRow(row)
    const nextForm = {
      name: row?.name ?? '',
      price: toNumber(row?.price),
      has_makeup: Boolean(row?.has_makeup),
      is_active: row?.is_active ?? true
    }
    setForm(nextForm)
    setInitialModalForm({
      name: String(nextForm.name || '').trim(),
      price: toNumber(nextForm.price),
      has_makeup: Boolean(nextForm.has_makeup),
      is_active: Boolean(nextForm.is_active)
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setActiveRow(null)
    setSaving(false)
    setInitialModalForm(null)
  }

  const confirmDiscardIfDirty = async () => {
    if (!isModalDirty) return true
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

  const requestCloseModal = async () => {
    if (saving) return
    const ok = await confirmDiscardIfDirty()
    if (!ok) return
    closeModal()
  }

  const columns = [
    {
      title: 'Tên gói',
      dataIndex: 'name',
      key: 'name',
      render: (v) => v || '(Chưa có tên)'
    },
    {
      title: 'Giá',
      dataIndex: 'price',
      key: 'price',
      align: 'right',
      render: (v) => toNumber(v).toLocaleString('vi-VN')
    },
    {
      title: 'Trạng thái',
      key: 'status_combo',
      render: (_, row) => {
        const isActive = row?.is_active !== false
        const hasMakeup = Boolean(row?.has_makeup)
        return (
          <div className="cv-packageBadges">
            <span className={isActive ? 'cv-miniBadge cv-miniBadge--success' : 'cv-miniBadge'}>
              {isActive ? 'Đang dùng' : 'Tạm ẩn'}
            </span>
            <span className="cv-miniBadge">{hasMakeup ? 'Make-up' : 'Không make-up'}</span>
          </div>
        )
      }
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_, row) => (
        <Space size={6} wrap>
          <Button
            type="text"
            aria-label="Sửa gói"
            onClick={() => openEdit(row)}
            icon={<span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>edit</span>}
          />
          <Button
            type="text"
            danger
            aria-label="Xoá gói"
            onClick={() => handleDelete(row)}
            icon={<span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>delete</span>}
          />
        </Space>
      )
    }
  ]

  const mobileColumns = [
    {
      title: 'Thông tin gói',
      key: 'summary',
      render: (_, row) => {
        const isActive = row?.is_active !== false
        const hasMakeup = Boolean(row?.has_makeup)
        return (
          <div className="cv-packageSummary">
            <div className="cv-packageSummaryTitle">Thông tin gói:</div>

            <div className="cv-packageSummaryLine">
              <span className="cv-packageSummaryLabel">Tên gói:</span>
              <span className="cv-packageSummaryValue">{row?.name || '(Chưa có tên)'}</span>
            </div>

            <div className="cv-packageSummaryLine">
              <span className="cv-packageSummaryLabel">Giá gói:</span>
              <span className="cv-packageSummaryValue">{toNumber(row?.price).toLocaleString('vi-VN')}</span>
            </div>

            <div className="cv-packageBadges" aria-label="Trạng thái">
              <span className={isActive ? 'cv-miniBadge cv-miniBadge--success' : 'cv-miniBadge'}>
                {isActive ? 'Đang dùng' : 'Tạm ẩn'}
              </span>
              <span className="cv-miniBadge">{hasMakeup ? 'Make-up' : 'Không make-up'}</span>
            </div>
          </div>
        )
      }
    }
  ]

  const handleSubmit = async () => {
    const payload = {
      name: String(form.name || '').trim(),
      price: toNumber(form.price),
      has_makeup: Boolean(form.has_makeup),
      is_active: Boolean(form.is_active)
    }

    if (!payload.name) {
      toast.error('Vui lòng nhập tên gói')
      return
    }

    setSaving(true)

    if (modalMode === 'create') {
      const { error } = await createPackage(payload)
      setSaving(false)

      if (error) {
        console.error(error)
        toast.error(error.message || 'Không thể tạo gói')
        return
      }

      toast.success('Đã tạo gói chụp')
      closeModal()
      await fetchPackages()
      return
    }

    const id = activeRow?.id
    if (!id) {
      setSaving(false)
      toast.error('Không tìm thấy ID gói để cập nhật')
      return
    }

    const { error } = await updatePackage(id, payload)
    setSaving(false)

    if (error) {
      console.error(error)
      toast.error(error.message || 'Không thể cập nhật gói')
      return
    }

    toast.success('Đã cập nhật gói chụp')
    closeModal()
    await fetchPackages()
  }

  const handleDelete = async (row) => {
    const id = row?.id
    if (!id) return

    Modal.confirm({
      title: 'Xoá gói chụp?',
      content: 'Hành động này không thể hoàn tác.',
      okText: 'Xoá',
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      onOk: async () => {
        const { error } = await deletePackage(id)
        if (error) {
          console.error(error)
          toast.error(error.message || 'Không thể xoá gói')
          return
        }

        toast.success('Đã xoá gói chụp')
        await fetchPackages()
      }
    })
  }

  const handleDeleteFromModal = async () => {
    const id = activeRow?.id
    if (!id) return

    Modal.confirm({
      title: 'Xoá gói chụp?',
      content: 'Hành động này không thể hoàn tác.',
      okText: 'Xoá',
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      onOk: async () => {
        const { error } = await deletePackage(id)
        if (error) {
          console.error(error)
          toast.error(error.message || 'Không thể xoá gói')
          return
        }

        toast.success('Đã xoá gói chụp')
        closeModal()
        await fetchPackages()
      }
    })
  }

  return (
    <div className="cv-container">
      <Card
        title={
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Typography.Title level={4} style={{ margin: 0 }}>Quản lí gói chụp</Typography.Title>
            <Space size={8} wrap>
              <Button
                size="middle"
                shape="circle"
                onClick={fetchPackages}
                loading={loading}
                aria-label="Tải lại"
                icon={<span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1, display: 'block' }}>refresh</span>}
              />
              <Button
                type="primary"
                size="middle"
                shape="circle"
                onClick={openCreate}
                aria-label="Thêm gói"
                icon={<span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1, display: 'block' }}>add</span>}
              />
            </Space>
          </Space>
        }
      >
        <Table
          rowKey={(r) => r.id}
          loading={loading}
          columns={isMobile ? mobileColumns : columns}
          dataSource={rows}
          pagination={false}
          showHeader={!isMobile}
          scroll={isMobile ? undefined : { x: 'max-content' }}
          locale={{
            emptyText: loading
              ? 'Đang tải…'
              : (
                  <div className="cv-emptyState cv-emptyState--compact">
                    <span className="material-symbols-rounded cv-emptyStateIcon" aria-hidden>
                      inventory_2
                    </span>
                    <div className="cv-emptyStateTitle">Chưa có gói chụp</div>
                    <div className="cv-emptyStateHint">Bạn có thể bấm nút “+” để thêm gói chụp mới.</div>
                  </div>
                )
          }}
          onRow={
            isMobile
              ? (record) => ({
                  onClick: () => openEdit(record)
                })
              : undefined
          }
        />
      </Card>

      <Modal
        open={modalOpen}
        title={<h1 className="cv-modalH1">{modalMode === 'create' ? 'Thêm gói chụp' : 'Cập nhật gói chụp'}</h1>}
        wrapClassName="cv-calendarModal"
        centered
        width={640}
        closeIcon={(
          <span className="material-symbols-rounded" style={{ fontSize: 22, lineHeight: 1 }}>
            close
          </span>
        )}
        onCancel={requestCloseModal}
        confirmLoading={saving}
        footer={
          <div className="cv-modalFooterGrid">
            {modalMode === 'edit' ? (
              <Button danger onClick={handleDeleteFromModal} disabled={saving} block style={{ gridColumn: 'span 12' }}>
                Xoá gói
              </Button>
            ) : null}
            <Button onClick={requestCloseModal} disabled={saving} block>
              Huỷ
            </Button>
            <Button type="primary" onClick={handleSubmit} loading={saving} block>
              {modalMode === 'create' ? 'Tạo gói chụp' : 'Lưu gói chụp'}
            </Button>
          </div>
        }
      >
        <div className="cv-modalGrid12">
          <div className="cv-col-12">
            <div className="cv-modalSection">
              <div className="cv-modalSectionTitle">Thông tin gói</div>

              <div className="cv-modalGrid12">
                <div className="cv-col-12">
                  <div className="cv-field">
                    <div className="cv-fieldLabel">Tên gói</div>
                    <Input
                      placeholder="Ví dụ: Gói Newborn"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="cv-col-6">
                  <div className="cv-field">
                    <div className="cv-fieldLabel">Giá</div>
                    <InputNumber
                      min={0}
                      step={50000}
                      value={toNumber(form.price)}
                      formatter={formatWithCommas}
                      parser={parseCommas}
                      onChange={(v) => setForm((p) => ({ ...p, price: toNumber(v) }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div className="cv-col-6">
                  <div className="cv-field">
                    <div className="cv-fieldLabel">Tùy chọn</div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <Typography.Text> Có makeup </Typography.Text>
                        <Switch
                          checked={Boolean(form.has_makeup)}
                          onChange={(checked) => setForm((p) => ({ ...p, has_makeup: checked }))}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <Typography.Text> Đang dùng </Typography.Text>
                        <Switch
                          checked={Boolean(form.is_active)}
                          onChange={(checked) => setForm((p) => ({ ...p, is_active: checked }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PackagesPage
export { PackagesPage }
