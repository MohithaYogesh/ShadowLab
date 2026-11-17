
import * as THREE from 'three'

// ==========================================
// CREATE PURPLE AND WHITE 3D BUTTERFLY
// ==========================================

function createButterfly() {
  const butterfly = new THREE.Group()

  // Purple wings
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: '#8A2BE2',
    roughness: 0.38,
    side: THREE.DoubleSide,
  })

  // White body
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.5,
  })

  // White spots
  const whiteSpotMaterial = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.4,
    side: THREE.DoubleSide,
  })

  // Wing shape
  const wingShape = new THREE.Shape()

  wingShape.moveTo(0, 0)
  wingShape.bezierCurveTo(0.15, 0.65, 0.9, 0.95, 1.05, 0.45)
  wingShape.bezierCurveTo(1.2, 0.05, 0.55, -0.25, 0, 0)

  const wingGeometry = new THREE.ShapeGeometry(wingShape, 24)

  // Add white spots to wings
  function addWhiteSpots(wingMesh) {
    const spots = [
      [0.3, 0.25],
      [0.55, 0.48],
      [0.82, 0.42],
      [0.65, 0.15],
    ]

    spots.forEach(([x, y]) => {
      const spot = new THREE.Mesh(
        new THREE.CircleGeometry(0.075, 24),
        whiteSpotMaterial,
      )

      spot.position.set(x, y, 0.02)
      spot.castShadow = false
      wingMesh.add(spot)
    })
  }

  // LEFT WING
  const leftWing = new THREE.Group()
  leftWing.name = 'leftWing'
  leftWing.position.set(-0.08, 0.15, 0)

  const leftWingMesh = new THREE.Mesh(
    wingGeometry,
    wingMaterial,
  )

  leftWingMesh.scale.x = -1
  leftWingMesh.castShadow = true

  addWhiteSpots(leftWingMesh)
  leftWing.add(leftWingMesh)

  // RIGHT WING
  const rightWing = new THREE.Group()
  rightWing.name = 'rightWing'
  rightWing.position.set(0.08, 0.15, 0)

  const rightWingMesh = new THREE.Mesh(
    wingGeometry,
    wingMaterial,
  )

  rightWingMesh.castShadow = true

  addWhiteSpots(rightWingMesh)
  rightWing.add(rightWingMesh)

  butterfly.add(leftWing, rightWing)

  // WHITE BODY
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.09, 0.65, 4, 8),
    bodyMaterial,
  )

  body.name = 'Butterfly body'
  body.rotation.z = Math.PI / 2
  body.castShadow = true

  butterfly.add(body)

  // WHITE HEAD
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 16, 12),
    bodyMaterial,
  )

  head.position.set(0, 0.43, 0)
  head.castShadow = true

  butterfly.add(head)

  // WHITE ANTENNAE
  const antennaMaterial = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
  })

  for (const direction of [-1, 1]) {
    const points = [
      new THREE.Vector3(0, 0.48, 0),
      new THREE.Vector3(direction * 0.12, 0.72, 0),
      new THREE.Vector3(direction * 0.28, 0.82, 0),
    ]

    const curve = new THREE.CatmullRomCurve3(points)

    const antenna = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 12, 0.018, 6, false),
      antennaMaterial,
    )

    antenna.castShadow = true
    butterfly.add(antenna)
  }

  // Butterfly animation identification
  butterfly.userData.isButterfly = true
  butterfly.userData.animated = true

  // Enable shadows
  butterfly.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  return butterfly
}

// ==========================================
// AVAILABLE 3D OBJECTS
// ==========================================

const PRIMITIVES = {
  cube: {
    name: 'Cube',
    type: 'BOX',
    color: '#d8b36a',
    halfHeight: 0.75,
    createGeometry: () => new THREE.BoxGeometry(1.5, 1.5, 1.5),
  },

  sphere: {
    name: 'Sphere',
    type: 'SPHERE',
    color: '#84b7a0',
    halfHeight: 0.84,
    createGeometry: () => new THREE.SphereGeometry(0.84, 48, 32),
  },

  cone: {
    name: 'Cone',
    type: 'CONE',
    color: '#d88364',
    halfHeight: 0.85,
    createGeometry: () => new THREE.ConeGeometry(0.82, 1.7, 48),
  },

  cylinder: {
    name: 'Cylinder',
    type: 'CYLINDER',
    color: '#8fa4cf',
    halfHeight: 0.85,
    createGeometry: () => new THREE.CylinderGeometry(0.72, 0.72, 1.7, 48),
  },

  pyramid: {
    name: 'Pyramid',
    type: 'PYRAMID',
    color: '#c98eae',
    halfHeight: 0.85,
    createGeometry: () => new THREE.ConeGeometry(0.9, 1.7, 4),
  },

  butterfly: {
    name: 'Butterfly',
    type: 'BUTTERFLY',
    color: '#8A2BE2',
    halfHeight: 1.4,
    createGeometry: () => createButterfly(),
  },
}

// ==========================================
// MATERIAL HELPERS
// ==========================================

function cloneMaterial(material) {
  return Array.isArray(material)
    ? material.map((part) => part.clone())
    : material.clone()
}

function getColor(mesh) {
  let color = null

  mesh.traverse((child) => {
    if (!color && child.isMesh) {
      const material = Array.isArray(child.material)
        ? child.material[0]
        : child.material

      if (material?.color) {
        color = `#${material.color.getHexString()}`
      }
    }
  })

  return color ?? '#ffffff'
}

// ==========================================
// OBJECT MANAGER
// ==========================================

export class ObjectManager {
  constructor(scene, initialObjects = []) {
    this.scene = scene
    this.records = []
    this.nextId = 1

    for (const object of initialObjects) {
      this.records.push(
        this.track(object.mesh, object.type, object.name),
      )
    }
  }

  track(mesh, type, name) {
    const record = {
      id: `object-${this.nextId++}`,
      name,
      type,
      color: getColor(mesh),
      mesh,
    }

    mesh.name = name
    mesh.userData.shadowLabId = record.id
    mesh.userData.primitiveType = type

    return record
  }

  get(id) {
    return this.records.find(
      (record) => record.id === id,
    ) ?? null
  }

  // ========================================
  // ADD OBJECT
  // ========================================

  add(primitive) {
    const definition = PRIMITIVES[primitive]
    if (!definition) return null

    const column = this.records.length % 5
    const row = Math.floor(this.records.length / 5)

    const existingOfType = this.records.filter(
      (record) => record.type === definition.type,
    ).length

    const name = existingOfType === 0
      ? definition.name
      : `${definition.name} ${existingOfType + 1}`

    const created = definition.createGeometry()

    const mesh = created.isBufferGeometry
      ? new THREE.Mesh(
          created,
          new THREE.MeshStandardMaterial({
            color: definition.color,
            roughness: 0.42,
            metalness: 0.08,
          }),
        )
      : created

    // Clone butterfly materials for independent editing
    if (!created.isBufferGeometry) {
      mesh.traverse((child) => {
        if (!child.isMesh) return

        child.material = cloneMaterial(child.material)
      })
    }

    mesh.position.set(
      (column - 2) * 2.4,
      definition.halfHeight,
      -row * 2.4,
    )

    mesh.castShadow = true
    mesh.receiveShadow = true

    this.scene.add(mesh)

    const record = this.track(
      mesh,
      definition.type,
      name,
    )

    record.color = definition.color
    this.records.push(record)

    return record
  }

  // ========================================
  // DUPLICATE OBJECT
  // ========================================

  duplicate(id) {
    const source = this.get(id)
    if (!source) return null

    const mesh = source.mesh.clone(true)

    mesh.traverse((child) => {
      if (!child.isMesh) return

      child.geometry = child.geometry.clone()
      child.material = cloneMaterial(child.material)
    })

    mesh.position.x += 1.15
    mesh.position.z -= 0.65

    const baseName = `${source.name} copy`
    let name = baseName
    let suffix = 2

    while (this.records.some(
      (record) => record.name === name,
    )) {
      name = `${baseName} ${suffix++}`
    }

    this.scene.add(mesh)

    const record = this.track(
      mesh,
      source.type,
      name,
    )

    record.color = source.color
    this.records.push(record)

    return record
  }

  // ========================================
  // CHANGE OBJECT COLOR
  // ========================================

  setColor(id, color) {
    const record = this.get(id)

    if (!record || !/^#[\da-f]{6}$/i.test(color)) {
      return false
    }

    record.mesh.traverse((child) => {
      if (!child.isMesh) return

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material]

      for (const material of materials) {
        if (material.color) {
          material.color.set(color)
        }
      }
    })

    record.color = color
    return true
  }

  // ========================================
  // DELETE OBJECT
  // ========================================

  remove(id) {
    const index = this.records.findIndex(
      (record) => record.id === id,
    )

    if (index < 0) return null

    const [record] = this.records.splice(index, 1)
    const mesh = record.mesh

    this.scene.remove(mesh)

    mesh.traverse((child) => {
      if (!child.isMesh) return

      this.disposeIfUnused(child.geometry, mesh)

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material]

      for (const material of materials) {
        this.disposeIfUnused(material, mesh)
      }
    })

    return record
  }

  // ========================================
  // RESOURCE CLEANUP
  // ========================================

  disposeIfUnused(resource, removedMesh) {
    if (!resource) return

    let inUse = false

    this.scene.traverse((object) => {
      if (object === removedMesh) return

      if (object.geometry === resource) {
        inUse = true
      }

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material]

      if (materials.includes(resource)) {
        inUse = true
      }
    })

    if (!inUse) {
      resource.dispose()
    }
  }
}
