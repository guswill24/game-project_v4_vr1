import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'

export default class VRIntegration {
  constructor({ renderer, scene, camera, vrDolly, modalManager, experience }) {
    this.vrDolly = vrDolly
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.modalManager = modalManager
    this.experience = experience
    this.characters = []
    this.clock = new THREE.Clock()
    this._preferredMoveButtonIndex = null

    this.arrowHelper = null
    this._movePressedLastFrame = false

    this.raycaster = new THREE.Raycaster()
    this.controllers = []
    this.lastIntersectedPrize = null

    this._initXR()
    this._setupDebugLog()
    this._setupControllers()

  }

  _initXR() {
    this.renderer.xr.enabled = true
    const vrBtn = VRButton.createButton(this.renderer)
    document.body.appendChild(vrBtn)

    setTimeout(() => {
      if (vrBtn.innerText?.includes('NOT SUPPORTED')) {
        vrBtn.style.display = 'none'
      } else {
        vrBtn.style.display = 'none'
      }
    }, 100)

    this.renderer.setAnimationLoop(() => {
      const delta = this.clock.getDelta()
      this._updateControllers(delta)
      this._updateLaserInteractions()
      if (this.updateCallback) this.updateCallback(delta)
      this.renderer.render(this.scene, this.camera)
    })
  }

  _setupControllers() {
    const laserGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1)
    ])
    const laserMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 })

    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i)
      controller.userData.selectPressed = false

      const laser = new THREE.Line(laserGeometry.clone(), laserMaterial)
      laser.scale.z = 5
      controller.add(laser)

      this.scene.add(controller)
      this.controllers.push(controller)
    }
  }

  bindCharacter(character) {
    this.characters.push(character)
  }

  async toggleVR() {
    if (this.experience?.world?.enemy) {
      this.experience.world.enemy.delayActivation = 60 // ⏱️ 1 minuto para que el usuario actúe
    }

    if (!navigator.xr) {
      this._showFallback('❌ WebXR no disponible en este navegador.')
      return
    }

    let supported = false
    try {
      supported = await navigator.xr.isSessionSupported('immersive-vr')
    } catch (err) {
      console.warn('Error comprobando soporte VR:', err)
    }

    if (!supported) {
      this._showFallback('🚫 VR inmersivo no soportado. Usa HTTPS o ngrok.')
      return
    }

    const session = this.renderer.xr.getSession()
    if (session) {
      try {
        await session.end()
        // 🧹 Eliminar panel VR si existía
        if (this._vrConsolePlane) {
          this.scene.remove(this._vrConsolePlane)
          this._vrConsolePlane.geometry.dispose()
          this._vrConsolePlane.material.dispose()
          this._vrConsolePlane = null
        }
      } catch (err) {
        console.error('Error al salir de VR:', err)
      }
    } else {
      try {
        const newSession = await navigator.xr.requestSession('immersive-vr', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['bounded-floor']
        })

        try {
          const ctx = Howler?.ctx
          if (ctx && ctx.state === 'suspended') {
            await ctx.resume()
            vrLog('🔊 AudioContext reanudado dentro de VR')
          }
        } catch (err) {
          console.warn('⚠️ Falló al reanudar AudioContext:', err)
        }

        this.renderer.xr.setSession(newSession)
        this._create3DLogPanel()

        if (this.experience?.menu?.toggleButton) {
          const button = this.experience.menu.toggleButton
          setTimeout(() => {
            button.style.display = 'block'
          }, 3000) // espera 3 segundos después de entrar a VR
        }

        if (this.experience?.menu?.object3D && this.camera) {
          const menu3D = this.experience.menu.object3D
          const camPos = this.camera.position.clone()
          const forward = new THREE.Vector3(0, -0.2, -1).applyQuaternion(this.camera.quaternion)

          menu3D.position.copy(camPos.clone().add(forward))
          menu3D.lookAt(camPos)
        }

        if (this.camera && this.experience?.world?.robot?.group) {
          this.experience.world.robot.group.visible = false
          const pos = new THREE.Vector3(5, 1.6, 5)
          this.camera.position.copy(pos)
          this.camera.lookAt(pos.clone().add(new THREE.Vector3(0, 0, -1)))
        }

        const overlay = document.createElement('div')
        overlay.innerText = '✅ VR ACTIVADO'
        overlay.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: black;
          color: lime;
          padding: 20px;
          font-size: 24px;
          z-index: 99999;
        `
        document.body.appendChild(overlay)
        setTimeout(() => overlay.remove(), 3000)

        vrLog('✅ Sesión VR iniciada correctamente')
      } catch (err) {
        console.error('No se pudo iniciar VR:', err)
        const msg = err.message.includes('secure')
          ? 'Las sesiones VR requieren un contexto seguro (HTTPS).'
          : 'Error al iniciar VR: ' + err.message
        this._showFallback('⚠️ ' + msg)
      }
    }
  }

  _updateLaserInteractions() {
    const intersectables = this.scene.children.filter(obj => obj.userData?.interactivo)
    this.lastIntersectedPrize = null

    for (const controller of this.controllers) {
      const tempMatrix = new THREE.Matrix4().extractRotation(controller.matrixWorld)
      const rayOrigin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld)
      const rayDirection = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix)

      this.raycaster.set(rayOrigin, rayDirection)

      const intersects = this.raycaster.intersectObjects(intersectables, true)

      if (intersects.length > 0) {
        const first = intersects[0]
        const mat = first.object.material

        if (Array.isArray(mat)) {
          mat.forEach(m => {
            if (m && m.emissive && typeof m.emissive.setHex === 'function') {
              m.emissive.setHex(0x00ff00)
            }
          })
        } else if (mat && mat.emissive && typeof mat.emissive.setHex === 'function') {
          mat.emissive.setHex(0x00ff00)
        }

        this.lastIntersectedPrize = first.object
      }

    }
  }

  _showFallback(text) {
    const warning = document.createElement('div')
    warning.innerText = text
    warning.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 0, 0, 0.85);
      color: white;
      padding: 10px 20px;
      font-size: 16px;
      font-family: sans-serif;
      border-radius: 8px;
      z-index: 9999;
    `
    document.body.appendChild(warning)
    setTimeout(() => warning.remove(), 5000)
  }

  setUpdateCallback(fn) {
    this.updateCallback = fn
  }

  _updateControllers(delta) {
    const session = this.renderer.xr.getSession()
    if (!session) return

    for (const source of session.inputSources) {
      if (!source.gamepad || !source.handedness) continue

      const gamepad = source.gamepad
      const buttons = gamepad.buttons

      // Log de botones en visor (se ve en la consola VR 3D también)
      const states = buttons.map((b, i) => `#${i}:${b.pressed ? '🟢' : '⚪️'}`).join(' ')
      vrLog(`Botones detectados: ${states}`)

      // FORZAR botón de movimiento si aún no hay asignado
      if (this._preferredMoveButtonIndex === null) {
        // Forzamos el botón 4, ya que es el que detectaste en tu visor
        this._preferredMoveButtonIndex = 4
        vrLog(`✅ Botón #4 forzado como botón de movimiento (gatillo A en Meta Quest)`)
      }

      const movePressed = buttons[this._preferredMoveButtonIndex]?.pressed

      if (movePressed) {
        const dir = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(this.camera.quaternion)
          .setY(0)
          .normalize()

        const speed = delta * 2.5 // Puedes ajustar la velocidad
        if (this.vrDolly) {
          this.vrDolly.position.addScaledVector(dir, speed)
        }

        if (!this.arrowHelper) {
          this.arrowHelper = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), 0.6, 0x00ff00)
          this.camera.add(this.arrowHelper)
          this.arrowHelper.position.set(0, -0.2, -0.5)
        } else {
          this.arrowHelper.setDirection(dir)
        }

        this._movePressedLastFrame = true
      } else {
        if (this._movePressedLastFrame && this.arrowHelper) {
          this.camera.remove(this.arrowHelper)
          this.arrowHelper.geometry.dispose()
          this.arrowHelper.material.dispose()
          this.arrowHelper = null
        }
        this._movePressedLastFrame = false
      }

      // Detectar láser sobre premio
      if (this.lastIntersectedPrize && !this.lastIntersectedPrize.userData.collected) {
        this.lastIntersectedPrize.userData.collected = true
        this.scene.remove(this.lastIntersectedPrize.parent)
        vrLog('🎁 Premio recogido con láser')
      }
    }
  }

  _setupDebugLog() {
    // Evitar mostrar en modo no-VR
    if (!this.renderer.xr.isPresenting) return;

    if (document.getElementById('vr-debug-log')) return;

    const el = document.createElement('div');
    el.id = 'vr-debug-log';
    el.style = `
    position: fixed;
    top: 20px;
    left: 20px;
    width: 90vw;
    max-height: 40vh;
    overflow-y: auto;
    background: rgba(196, 3, 3, 0.75);
    color: #0f0;
    font-family: monospace;
    font-size: 14px;
    padding: 10px;
    border-radius: 6px;
    z-index: 999999;
    pointer-events: none;
    white-space: pre-wrap;
  `;
    document.body.appendChild(el);

    window.vrLog = (msg) => {
      const logBox = document.getElementById('vr-debug-log');
      if (!logBox) return;

      const time = new Date().toLocaleTimeString();
      const text = typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg;
      logBox.innerText += `[${time}] ${text}\n`;
      logBox.scrollTop = logBox.scrollHeight;
    };
  }


  _create3DLogPanel() {
    // ✅ Solo mostrar en modo VR
    if (!this.renderer.xr.isPresenting) return;

    const planeGeometry = new THREE.PlaneGeometry(2, 1.2)
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'lime'
    ctx.font = '24px monospace'
    ctx.fillText('🟢 Consola VR', 20, 40)

    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
    const plane = new THREE.Mesh(planeGeometry, material)
    plane.position.set(0, 1.5, -2)

    this.scene.add(plane)
    this._vrConsoleCanvas = canvas
    this._vrConsoleCtx = ctx
    this._vrConsoleTexture = texture
    this._vrConsolePlane = plane
    this._vrConsoleLines = ['🟢 Consola VR']

    window.vrLog = (msg) => {
      const text = typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg
      this._vrConsoleLines.push(text)
      if (this._vrConsoleLines.length > 10) this._vrConsoleLines.shift()

      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = 'lime'
      ctx.font = '24px monospace'
      this._vrConsoleLines.forEach((line, i) => {
        ctx.fillText(line, 20, 40 + i * 36)
      })

      texture.needsUpdate = true
    }
  }



}