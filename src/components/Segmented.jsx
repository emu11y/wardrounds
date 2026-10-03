// Shared iOS-style segmented control (pill track, white selected segment).
// Used by the Shift form and the onboarding wizard.
export default function Segmented({ options, value, onChange }) {
  return (
    <div className="flex bg-black/[0.05] rounded-full p-1 gap-1">
      {options.map(o => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)}
          className={`flex-1 px-3 py-1.5 rounded-full text-xs font-semibold transition ${value === o.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
