import { PageHeader } from '../components/Layout'
import { Settings2 } from 'lucide-react'

export default function Settings() {
  return (
    <div className="p-8 max-w-2xl">
      <PageHeader
        title="Configuración"
        subtitle="Ajustes generales de SIPROFILM"
      />
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <Settings2 size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Configuración de usuarios e integraciones — próximamente en v2.</p>
      </div>
    </div>
  )
}
