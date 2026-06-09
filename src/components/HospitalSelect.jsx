import { ChevronDown } from 'lucide-react'

export default function HospitalSelect({ hospitals, hospitalId, ward, onHospitalChange, onWardChange }) {
  const selectedHospital = hospitals.find(h => h.id === hospitalId)
  const services = selectedHospital?.hospital_services || []

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Hospital</label>
        <div className="relative">
          <select
            value={hospitalId}
            onChange={e => { onHospitalChange(e.target.value); onWardChange('') }}
            className="ios-input appearance-none pr-9"
          >
            <option value="">Select hospital…</option>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-1 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Ward / Service</label>
        {hospitalId && services.length > 0 ? (
          <div className="relative">
            <select
              value={ward}
              onChange={e => onWardChange(e.target.value)}
              className="ios-input appearance-none pr-9"
            >
              <option value="">Select ward…</option>
              {services.map(s => (
                <option key={s.id} value={s.service_name}>{s.service_name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-1 pointer-events-none" />
          </div>
        ) : (
          <input
            type="text"
            value={ward}
            onChange={e => onWardChange(e.target.value)}
            placeholder="e.g. Ward 3, ICU, Maternity"
            className="ios-input"
          />
        )}
      </div>
    </div>
  )
}
