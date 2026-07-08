export default function MockIconTile({ accentColor, icon: Icon, size = 16 }) {
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: accentColor + '20' }}
    >
      <Icon size={size} style={{ color: accentColor }} />
    </div>
  )
}
