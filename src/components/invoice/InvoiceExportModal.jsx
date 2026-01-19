import { Modal, Button } from 'antd'
import html2canvas from 'html2canvas'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import InvoicePreview from './InvoicePreview'

import '../../styles/pages/invoice-preview.css'

export default function InvoiceExportModal({
  open,
  booking,
  invoice,
  onClose
}) {
  const captureRef = useRef(null)
  const viewportRef = useRef(null)
  const [scale, setScale] = useState(1)

  // CSS mm units map to 96dpi in browsers (A4 width ~= 794px)
  const A4_WIDTH_PX = 794

  useLayoutEffect(() => {
    if (!open) return

    const el = viewportRef.current
    if (!el) return

    const compute = () => {
      const w = el.clientWidth
      if (!w) return
      const next = Math.max(0.2, Math.min(1, (w - 16) / A4_WIDTH_PX))
      setScale(next)
    }

    compute()

    const ro = new ResizeObserver(() => compute())
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  const safeFileName = useMemo(() => {
    const rawName = String(booking?.customer_name || 'khach').trim() || 'khach'
    return rawName
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
  }, [booking?.customer_name])

  const handleExport = async () => {
    const node = captureRef.current
    if (!node) return

    // Wait for images (e.g., qr.jpg) to load so export doesn't capture blank boxes.
    const imgs = Array.from(node.querySelectorAll('img'))
    await Promise.all(
      imgs.map((img) => {
        if (img.complete) return Promise.resolve()
        return new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true })
          img.addEventListener('error', resolve, { once: true })
        })
      })
    )

    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: null,
      useCORS: true,
      ignoreElements: (el) => {
        const tag = (el?.tagName || '').toLowerCase()
        if (tag === 'button') return true

        const role = String(el?.getAttribute?.('role') || '').toLowerCase()
        if (role === 'button') return true

        const ignore = String(el?.getAttribute?.('data-export-ignore') || '').toLowerCase()
        if (ignore === 'true' || ignore === '1') return true

        // Ant buttons
        const cls = typeof el?.className === 'string' ? el.className : ''
        if (cls.includes('ant-btn')) return true

        return false
      }
    })

    const link = document.createElement('a')
    link.download = `hoa-don-${safeFileName}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  return (
    <Modal
      open={open}
      width="min(980px, calc(100vw - 24px))"
      onCancel={onClose}
      maskClosable
      keyboard
      footer={[
        <Button key="close" onClick={onClose}>Đóng</Button>,
        <Button key="export" type="primary" onClick={handleExport}>
          Tải ảnh
        </Button>
      ]}
      centered
      styles={{ body: { padding: 0 } }}
    >
      <div className="cv-invoicePreviewViewport" ref={viewportRef}>
        <div
          className="cv-invoicePreviewScaled"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
        >
          <InvoicePreview booking={booking} invoice={invoice} />
        </div>
      </div>

      {/* Hidden unscaled copy for export fidelity */}
      <div className="cv-invoicePreviewCapture" aria-hidden>
        <InvoicePreview ref={captureRef} booking={booking} invoice={invoice} />
      </div>
    </Modal>
  )
}
