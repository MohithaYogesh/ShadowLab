import * as THREE from 'three'

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
}

function cloneMaterial(material) {
  return Array.isArray(material) ? material.map((part) => part.clone()) : material.clone()
}

function getColor(mesh) {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  return material?.color ? `#${material.color.getHexString()}` : '#ffffff'
}

export class ObjectManager {
  constructor(scene, initialObjects = []) {
    this.scene = scene
    this.records = []
    this.nextId = 1

    for (const object of initialObjects) {
      this.records.push(this.track(object.mesh, object.type, object.name))
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
    return this.records.find((record) => record.id === id) ?? null
  }

  add(primitive) {
    const definition = PRIMITIVES[primitive]
    if (!definition) return null

    const column = this.records.length % 5
    const row = Math.floor(this.records.length / 5)
    const existingOfType = this.records.filter((record) => record.type === definition.type).length
    const name = existingOfType === 0 ? definition.name : `${definition.name} ${existingOfType + 1}`
    const mesh = new THREE.Mesh(
      definition.createGeometry(),
      new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.42, metalness: 0.08 }),
    )
    mesh.position.set((column - 2) * 2.4, definition.halfHeight, -row * 2.4)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.scene.add(mesh)

    const record = this.track(mesh, definition.type, name)
    record.color = definition.color
    this.records.push(record)
    return record
  }

  duplicate(id) {
    const source = this.get(id)
    if (!source) return null

    const mesh = source.mesh.clone()
    mesh.geometry = source.mesh.geometry.clone()
    mesh.material = cloneMaterial(source.mesh.material)
    mesh.position.x += 1.15
    mesh.position.z -= 0.65

    const baseName = `${source.name} copy`
    let name = baseName
    let suffix = 2
    while (this.records.some((record) => record.name === name)) {
      name = `${baseName} ${suffix++}`
    }

    this.scene.add(mesh)
    const record = this.track(mesh, source.type, name)
    record.color = source.color
    this.records.push(record)
    return record
  }

  setColor(id, color) {
    const record = this.get(id)
    if (!record || !/^#[\da-f]{6}$/i.test(color)) return false

    const materials = Array.isArray(record.mesh.material) ? record.mesh.material : [record.mesh.material]
    for (const material of materials) {
      if (material.color) material.color.set(color)
      if (material.uniforms?.uMaterialColor) material.uniforms.uMaterialColor.value.set(color)
    }
    record.color = color
    return true
  }

  remove(id) {
    const index = this.records.findIndex((record) => record.id === id)
    if (index < 0) return null

    const [record] = this.records.splice(index, 1)
    const mesh = record.mesh
    this.scene.remove(mesh)
    this.disposeIfUnused(mesh.geometry, mesh)

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) this.disposeIfUnused(material, mesh)

    return record
  }

  disposeIfUnused(resource, removedMesh) {
    if (!resource) return

    let inUse = false
    this.scene.traverse((object) => {
      if (object === removedMesh) return
      if (object.geometry === resource) inUse = true
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      if (materials.includes(resource)) inUse = true
    })

    if (!inUse) resource.dispose()
  }
}