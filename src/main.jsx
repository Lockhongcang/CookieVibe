import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './index.css'
import './styles/components/modal.css'
import './styles/overrides/antd-inputs.css'
import App from './App.jsx'

dayjs.locale('vi')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          // CookieVibe palette
          colorPrimary: '#5B3A1F',
          colorInfo: '#5B3A1F',
          colorSuccess: '#4E9F3D',
          colorWarning: '#E5B400',
          colorError: '#E24A3B',
          colorText: '#2A1F16',
          colorTextSecondary: '#6F6256',
          colorBgBase: '#FFFEF9',
          colorBorder: '#E6DED4',
          borderRadius: 12,
          // Focus ring (used widely across controls)
          controlOutline: '#EFE4D8'
        },
        components: {
          Input: {
            activeBorderColor: '#5B3A1F',
            hoverBorderColor: '#B08A62',
            activeShadow: '0 0 0 3px #EFE4D8'
          },
          Select: {
            optionSelectedBg: '#EFE4D8',
            optionActiveBg: '#EFE4D8'
          },
          DatePicker: {
            activeBorderColor: '#5B3A1F',
            hoverBorderColor: '#B08A62',
            activeShadow: '0 0 0 3px #EFE4D8'
          },
          TimePicker: {
            activeBorderColor: '#5B3A1F',
            hoverBorderColor: '#B08A62',
            activeShadow: '0 0 0 3px #EFE4D8'
          },
          InputNumber: {
            activeBorderColor: '#5B3A1F',
            hoverBorderColor: '#B08A62',
            activeShadow: '0 0 0 3px #EFE4D8'
          },
          Button: {
            // Ensure primary buttons follow the same tone in all states
            colorPrimaryHover: '#3A2312',
            colorPrimaryActive: '#3A2312'
          },
          Switch: {
            colorPrimary: '#5B3A1F'
          }
        }
      }}
    >
      <App />
      <ToastContainer position="top-right" autoClose={2500} hideProgressBar={false} newestOnTop />
    </ConfigProvider>
  </StrictMode>,
)
