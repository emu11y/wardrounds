import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, Upload, X, Loader, RefreshCw } from 'lucide-react'
import { scanPatientCard } from '../lib/api'

export default function QRScanner({ onExtract }) {
  const [mode, setMode] = useState('idle') // idle | camera | scanning | error
  const [errorMsg, setErrorMsg] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  async function startCamera() {
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setMode('camera')
    } catch {
      setErrorMsg('Camera access denied. Use file upload instead.')
      setMode('error')
    }
  }

  async function capture() {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0)
    const base64 = canvas.toDataURL('image/png').split(',')[1]
    stopCamera()
    await processImage(base64, 'image/png')
  }

  function fileToBase64PNG(file) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        canvas.getContext('2d').drawImage(img, 0, 0)
        const base64 = canvas.toDataURL('image/png').split(',')[1]
        URL.revokeObjectURL(objectUrl)
        resolve(base64)
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Could not load image'))
      }
      img.src = objectUrl
    })
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMode('scanning')
    try {
      const base64 = await fileToBase64PNG(file)
      await processImage(base64, 'image/png')
    } catch (err) {
      setErrorMsg(err.message || 'Could not load image')
      setMode('error')
    }
    e.target.value = ''
  }

  async function processImage(base64, mediaType) {
    setMode('scanning')
    setErrorMsg('')
    try {
      const result = await scanPatientCard(base64, mediaType)
      onExtract(result)
      setMode('idle')
    } catch (err) {
      setErrorMsg(err.message || 'Could not extract patient info. Try a clearer image.')
      setMode('error')
    }
  }

  function reset() {
    stopCamera()
    setMode('idle')
    setErrorMsg('')
  }

  if (mode === 'camera') {
    return (
      <div className="space-y-3">
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-4/5 aspect-[1.586/1]">
              <div className="absolute inset-0 border border-white/30 rounded-xl" />
              <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-white rounded-br-lg" />
            </div>
          </div>
          <button
            onClick={reset}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white"
          >
            <X size={16} />
          </button>
          <p className="absolute bottom-3 left-0 right-0 text-center text-white/70 text-xs">
            Align card within the frame
          </p>
        </div>
        <button
          onClick={capture}
          className="w-full py-3.5 rounded-2xl bg-ios-blue text-white font-semibold flex items-center justify-center gap-2"
        >
          <Camera size={18} />
          Capture Card
        </button>
      </div>
    )
  }

  if (mode === 'scanning') {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <div className="w-14 h-14 rounded-2xl bg-ios-blue/10 flex items-center justify-center">
          <Loader size={26} className="text-ios-blue animate-spin" />
        </div>
        <p className="font-medium text-sm">Scanning with Claude Vision…</p>
        <p className="text-xs text-ios-gray-1">Extracting patient details from card</p>
      </div>
    )
  }

  if (mode === 'error') {
    return (
      <div className="space-y-3">
        <div className="p-4 rounded-2xl bg-ios-red/10 text-ios-red text-sm text-center">
          {errorMsg}
        </div>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-ios-gray-4 text-sm font-medium"
          >
            <RefreshCw size={15} />
            Try Again
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-ios-blue/10 text-ios-blue text-sm font-medium"
          >
            <Upload size={15} />
            Upload File
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* PRIMARY: native camera — opens OS camera on mobile, file picker on desktop */}
      <button
        onClick={() => cameraInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-ios-blue text-white font-semibold hover:bg-blue-600 transition-all active:scale-95"
      >
        <Camera size={20} />
        Take Photo
      </button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-ios-gray-4" />
        <span className="text-xs text-ios-gray-1">or</span>
        <div className="flex-1 h-px bg-ios-gray-4" />
      </div>

      {/* SECONDARY: live viewfinder (desktop / browser-camera) */}
      <button
        onClick={startCamera}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-ios-blue/10 text-ios-blue font-medium hover:bg-ios-blue/20 transition-all"
      >
        <Camera size={18} />
        Open Camera
      </button>

      {/* TERTIARY: file picker */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border-2 border-dashed border-ios-gray-4 text-ios-gray-1 font-medium hover:border-ios-blue/50 hover:text-ios-blue transition-all"
      >
        <Upload size={18} />
        Choose File
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <p className="text-xs text-ios-gray-1 text-center leading-relaxed">
        Point camera at a hospital ID card or insurance card.
        Claude Vision extracts patient details automatically.
      </p>
    </div>
  )
}
