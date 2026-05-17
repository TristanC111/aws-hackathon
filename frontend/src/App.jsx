import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { SessionProvider } from './context/SessionContext'
import UploadScreen from './screens/UploadScreen'
import ExplainScreen from './screens/ExplainScreen'
import FormFillScreen from './screens/FormFillScreen'
import ReviewScreen from './screens/ReviewScreen'
import DirectFillScreen from './screens/DirectFillScreen'

export default function App() {
  return (
    <SessionProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: '12px',
            background: '#1f2937',
            color: '#fff',
            fontSize: '15px',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<UploadScreen />} />
        <Route path="/explain" element={<ExplainScreen />} />
        <Route path="/form" element={<FormFillScreen />} />
        <Route path="/direct" element={<DirectFillScreen />} />
        <Route path="/review" element={<ReviewScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  )
}
