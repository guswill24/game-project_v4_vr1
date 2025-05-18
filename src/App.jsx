import { useEffect, useRef, useState } from 'react';
import Experience from './Experience/Experience';
import './styles/loader.css'; // Asegúrate de importar el CSS

const App = () => {
  const canvasRef = useRef();
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const experience = new Experience(canvasRef.current);

    // Escuchar eventos personalizados desde Resources.js
    window.addEventListener('resource-progress', (e) => {
      setProgress(e.detail);
    });

    window.addEventListener('resource-complete', () => {
      setLoading(false);
    });

  }, []);

  return (
    <>
      {loading && (
        <div id="loader-overlay">
          <div id="loader-bar" style={{ width: `${progress}%` }}></div>
          <div id="loader-text">Cargando... {progress}%</div>
        </div>
      )}
      <canvas ref={canvasRef} className="webgl" />
    </>
  );
};

export default App;
