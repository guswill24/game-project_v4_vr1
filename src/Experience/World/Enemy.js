import * as THREE from 'three'
import * as CANNON from 'cannon-es'

export default class Enemy {
    constructor({ scene, physicsWorld, playerRef, model, position, experience }) {
        this.experience = experience
        this.scene = scene
        this.physicsWorld = physicsWorld
        this.playerRef = playerRef // referencia al robot
        this.speed = 2.0

        // Modelo 3D (puede ser cargado externamente)
        this.model = model.clone()
        this.model.position.copy(position)
        this.scene.add(this.model)

        // Física simple (esfera por ahora)
        const shape = new CANNON.Sphere(0.5)
        this.body = new CANNON.Body({
            mass: 1,
            shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.9
        })
        this.body.sleepSpeedLimit = 0.0  // Previene que se duerma
        this.body.wakeUp()
        this.physicsWorld.addBody(this.body)

        // Asociar body al modelo
        this.model.userData.physicsBody = this.body
    }

    update(delta) {
        if (!this.experience?.world?.gameStarted) return

        if (!this.playerRef?.body) return

        const targetPos = this.playerRef.body.position
        const enemyPos = this.body.position

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

        // Sync visual with physics
        this.model.position.set(
            this.body.position.x,
            this.body.position.y,
            this.body.position.z
        )

    }

    destroy() {
        this.scene.remove(this.model)
        this.physicsWorld.removeBody(this.body)
    }
}
