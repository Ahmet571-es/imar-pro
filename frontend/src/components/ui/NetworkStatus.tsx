/**
 * NetworkStatus — Çevrimdışı olduğunda banner gösterir.
 * Bağlantı geri gelince otomatik kapanır.
 */

import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

export function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const goOffline = () => { setIsOffline(true); setWasOffline(true) }
    const goOnline = () => {
      setIsOffline(false)
      // "Bağlantı geri geldi" mesajını 3 saniye göster
      setTimeout(() => setWasOffline(false), 3000)
    }

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    // Başlangıç durumu
    if (!navigator.onLine) goOffline()

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!isOffline && !wasOffline) return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] text-center py-2 px-4 text-sm font-medium transition-all duration-300 ${
      isOffline
        ? 'bg-red-600 text-white'
        : 'bg-green-600 text-white'
    }`}>
      {isOffline ? (
        <span className="flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          İnternet bağlantısı kesildi. Bazı özellikler çalışmayabilir.
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          <Wifi className="w-4 h-4" />
          Bağlantı geri geldi!
        </span>
      )}
    </div>
  )
}
