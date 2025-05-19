import { useEffect, useRef, useState } from 'react'
import Experience from './Experience/Experience'
import './styles/loader.css'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'

const App = () => {
  const canvasWrapperRef = useRef()
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [experience, setExperience] = useState(null)

  useEffect(() => {
    const handleProgress = (e) => setProgress(e.detail)
    const handleComplete = () => setLoading(false)

    window.addEventListener('resource-progress', handleProgress)
    window.addEventListener('resource-complete', handleComplete)

    return () => {
      window.removeEventListener('resource-progress', handleProgress)
      window.removeEventListener('resource-complete', handleComplete)
    }
  }, [])

  const handleCanvasCreated = ({ camera, gl }) => {
    const canvasElement = canvasWrapperRef.current.querySelector('canvas')
    const exp = new Experience(canvasElement)
    exp.reactCamera = camera      // ✅ Pasamos la cámara de Fiber
    exp.reactRenderer = gl        // ✅ Pasamos el renderer de Fiber
    setExperience(exp)
  }

  return (
    <>
      {loading && (
        <div id="loader-overlay">
          <div id="loader-bar" style={{ width: `${progress}%` }}></div>
          <div id="loader-text">Cargando... {progress}%</div>
        </div>
      )}
      <div ref={canvasWrapperRef} style={{ width: '100vw', height: '100vh' }}>
        <Canvas className="webgl" onCreated={handleCanvasCreated}>
          <Suspense fallback={null}>
            {experience?.VRComponent && <experience.VRComponent />}
          </Suspense>
        </Canvas>
      </div>
    </>
  )
}

export default App
