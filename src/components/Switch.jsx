// Shared iOS-style switch (same look as the Settings reminders/WhatsApp toggles).
export default function Switch({ checked, onChange, id, label, disabled = false }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 disabled:opacity-50 ${
        checked ? 'bg-ios-blue' : 'bg-gray-300'
      }`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}
