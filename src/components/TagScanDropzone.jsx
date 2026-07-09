import { useState } from 'react'
import { Camera, X } from 'lucide-react'

// Shared hospital-tag scan dropzone. One source of truth for the three scan
// entry points (Admit Patient, New Visit / Log Outpatient, and the ad-hoc
// booking scan in Appointments). Controlled: the consumer owns preview / error /
// scanning state and its own extraction logic in `onFile(file)`.
//
// The native file input intentionally has NO `capture` attribute, so mobile
// users get the OS picker (Camera OR Photo Library) instead of being forced
// straight into the camera. Desktop additionally supports drag-and-drop.
export default function TagScanDropzone({
  onFile,
  isScanning = false,
  preview = null,
  error = null,
  onClear,
  subtitle = 'Aga Khan · M.P Shah · Avenue Healthcare',
  disabled = false,
}) {
  const [dragging, setDragging] = useState(false)

  function pickFile(file) {
    if (!file || isScanning || disabled) return
    if (!file.type?.startsWith('image/')) return
    onFile(file)
  }

  return (
    <div className="space-y-3">
      <label
        className="block cursor-pointer"
        onDragOver={(e) => { e.preventDefault(); if (!isScanning && !disabled) setDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }}
      >
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled || isScanning}
          onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }}
        />
        <div className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed overflow-hidden min-h-44 transition-all ${
          isScanning || dragging
            ? 'border-ios-blue/40 bg-ios-blue/5'
            : 'border-ios-gray-4 bg-ios-gray-6 hover:border-ios-blue/50 hover:bg-ios-blue/5'
        }`}>
          {preview ? (
            <img src={preview} alt="Tag preview" className="w-full max-h-52 object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-ios-gray-1">
              <Camera size={36} strokeWidth={1.2} className="opacity-30" />
              <p className="text-sm font-medium">Add a tag photo — camera, gallery, or drop</p>
              <p className="text-xs opacity-50">{subtitle}</p>
            </div>
          )}
          {isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-black/70 gap-2">
              <div className="w-7 h-7 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
              <p className="text-sm font-semibold text-ios-blue">Reading tag…</p>
            </div>
          )}
        </div>
      </label>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl text-sm text-red-600 dark:text-red-400">
          <X size={14} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {(preview || error) && !isScanning && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="w-full py-2.5 rounded-2xl text-sm font-medium text-ios-gray-1 bg-ios-gray-6 hover:bg-ios-gray-5 transition-all"
        >
          Clear &amp; try again
        </button>
      )}
    </div>
  )
}
