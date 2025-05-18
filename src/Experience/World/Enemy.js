import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import FinalPrizeParticles from '../Utils/FinalPrizeParticles.js'
import Sound from './Sound.js'

export default class Enemy {
    constructor({ scene, physicsWorld, playerRef, model, position, experience }) {
        this.experience = experience
        this.scene = scene
        this.physicsWorld = physicsWorld
        this.playerRef = playerRef
        this.baseSpeed = 3.0
        this.speed = this.baseSpeed
        this.delayActivation = 30 // por defecto activo



        // 🔊 Sonido de proximidad en loop
        this.proximitySound = new Sound('/sounds/alert.ogg', {
            loop: true,
            volume: 0
        })
        this._soundCooldown = 0
        this.proximitySound.play()

        // 🧱 Modelo visual
        this.model = model.clone()
        this.model.position.copy(position)
        this.scene.add(this.model)

        // ⚙️ Material físico del enemigo
        const enemyMaterial = new CANNON.Material('enemyMaterial')
        enemyMaterial.friction = 0.0

        // 🧱 Cuerpo físico
        const shape = new CANNON.Sphere(0.5)
        this.body = new CANNON.Body({
            mass: 5,
            shape,
            material: enemyMaterial,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.01
        })

        this.body.sleepSpeedLimit = 0.0
        this.body.wakeUp()
        this.physicsWorld.addBody(this.body)

        // Asocia el cuerpo al modelo
        this.model.userData.physicsBody = this.body

        // 🧩 Colisión con robot
        this._onCollide = (event) => {
            if (event.body === this.playerRef.body) {
                if (typeof this.playerRef.die === 'function') {
                    this.playerRef.die()
                }

                if (this.proximitySound) {
                    this.proximitySound.stop()
                }

                if (this.model.parent) {
                    new FinalPrizeParticles({
                        scene: this.scene,
                        targetPosition: this.body.position,
                        sourcePosition: this.body.position,
                        experience: this.experience
                    })

                    this.destroy()
                }
            }
        }

        this.body.addEventListener('collide', this._onCollide)
    }

    update(delta) {
        if (this.delayActivation > 0) {
            this.delayActivation -= delta
            return
        }

        if (!this.body || !this.playerRef?.body || !this.experience?.world?.gameStarted) return

        const targetPos = this.playerRef.body.position
        const enemyPos = this.body.position

        // 🎧 Volumen según cercanía
        const distance = enemyPos.distanceTo(targetPos)
        if (distance < 4) {
            this.speed = 5.0
        } else {
            this.speed = this.baseSpeed
        }
        const maxDistance = 10
        const clampedDistance = Math.min(distance, maxDistance)
        const proximityVolume = 1 - (clampedDistance / maxDistance)

        if (this.proximitySound) {
            this.proximitySound.setVolume(proximityVolume * 0.8)
        }

        // 🧭 Movimiento directo hacia el robot
        const direction = new CANNON.Vec3(
            targetPos.x - enemyPos.x,
            0,
            targetPos.z - enemyPos.z
        )

        if (direction.length() > 0.5) {
            direction.normalize()
            direction.scale(this.speed, direction)
            this.body.velocity.x = direction.x
            this.body.velocity.z = direction.z
        }

        // 🎯 Sincronizar modelo visual
        this.model.position.copy(this.body.position)
    }

    destroy() {
        if (this.model) {
            this.scene.remove(this.model)
        }

        if (this.proximitySound) {
            this.proximitySound.stop()
        }

        if (this.body) {
            this.body.removeEventListener('collide', this._onCollide)

            if (this.physicsWorld.bodies.includes(this.body)) {
                this.physicsWorld.removeBody(this.body)
            }

            this.body = null
        }
    }
}
