import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'

export default class VRIntegration {
  constructor({ renderer, scene, camera, modalManager, experience }) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.modalManager = modalManager
    this.experience = experience
    this.characters = []
    this.clock = new THREE.Clock()

    this.arrowHelper = null
    this._movePressedLastFrame = false

    this.raycaster = new THREE.Raycaster()
    this.controllers = []
    this.lastIntersectedPrize = null

    this._initXR()
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
            console.log('🔊 AudioContext reanudado dentro de VR')
          }
        } catch (err) {
          console.warn('⚠️ Falló al reanudar AudioContext:', err)
        }

        this.renderer.xr.setSession(newSession)

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

        console.log('✅ Sesión VR iniciada correctamente')
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
        first.object.material.emissive?.setHex(0x00ff00)
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
      const isPressed = gamepad.buttons[0]?.pressed

      if (isPressed) {
        const dir = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(this.camera.quaternion)
          .setY(0)
          .normalize()

        const speed = delta * 3

        if (!this.arrowHelper) {
          this.arrowHelper = new THREE.ArrowHelper(
            dir.clone(),
            new THREE.Vector3(0, 0, 0),
            0.5,
            0x00ff00
          )
          this.camera.add(this.arrowHelper)
          this.arrowHelper.position.set(0, -0.2, -0.5)
        } else {
          this.arrowHelper.setDirection(dir.clone())
        }

        this.camera.position.addScaledVector(dir, speed)
        this._movePressedLastFrame = true

        if (this.lastIntersectedPrize && !this.lastIntersectedPrize.userData.collected) {
          this.lastIntersectedPrize.userData.collected = true
          this.scene.remove(this.lastIntersectedPrize.parent)
          console.log('🟢 Premio recogido con rayo láser VR')
        }
      } else {
        if (this._movePressedLastFrame && this.arrowHelper) {
          this.camera.remove(this.arrowHelper)
          this.arrowHelper.geometry.dispose()
          this.arrowHelper.material.dispose()
          this.arrowHelper = null
        }
        this._movePressedLastFrame = false
      }
    }
  }
}