import * as THREE from 'three'

const OBJECTS = [
  {
    name: 'Cube',
    type: 'BOX',
    color: '#d8b36a',
    position: [-4.8, 0.75, 0],
    geometry: () => new THREE.BoxGeometry(1.5, 1.5, 1.5),
  },
  {
    name: 'Sphere',
    type: 'SPHERE',
    color: '#84b7a0',
    position: [-2.4, 0.84, 0],
    geometry: () => new THREE.SphereGeometry(0.84, 48, 32),
  },
  {
    name: 'Cone',
    type: 'CONE',
    color: '#d88364',
    position: [0, 0.85, 0],
    geometry: () => new THREE.ConeGeometry(0.82, 1.7, 48),
  },
  {
    name: 'Cylinder',
    type: 'CYLINDER',
    color: '#8fa4cf',
    position: [2.4, 0.85, 0],
    geometry: () => new THREE.CylinderGeometry(0.72, 0.72, 1.7, 48),
  },
  {
    name: 'Pyramid',
    type: 'PYRAMID',
    color: '#c98eae',
    position: [4.8, 0.85, 0],
    geometry: () => new THREE.ConeGeometry(0.9, 1.7, 4),
  },
]

export function createInitialScene(container) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#111612')
  scene.fog = new THREE.Fog('#111612', 18, 38)

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  const lookTarget = new THREE.Vector3(0, 0.65, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  renderer.domElement.setAttribute('aria-label', 'Rendered 3D scene of five geometric primitives')
  renderer.domElement.setAttribute('role', 'img')
  container.append(renderer.domElement)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshStandardMaterial({ color: '#171e19', roughness: 1 }),
  )
  ground.name = 'Ground plane'
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.02
  ground.receiveShadow = true
  scene.add(ground)

  const grid = new THREE.GridHelper(16, 16, '#829574', '#39463d')
  grid.position.y = 0.008
  grid.material.transparent = true
  grid.material.opacity = 0.48
  grid.material.depthWrite = false
  scene.add(grid)

  const hemisphereLight = new THREE.HemisphereLight('#e4eadc', '#39473c', 2)
  scene.add(hemisphereLight)

  const keyLight = new THREE.DirectionalLight('#fff0d3', 2.5)
  keyLight.position.set(-5, 9, 6)
  keyLight.castShadow = true
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight('#b8cbed', 0.55)
  fillLight.position.set(6, 4, -5)
  fillLight.castShadow = false
  scene.add(fillLight)

  const objects = OBJECTS.map((definition) => {
    const material = new THREE.MeshStandardMaterial({
      color: definition.color,
      roughness: 0.42,
      metalness: 0.08,
    })
    const mesh = new THREE.Mesh(definition.geometry(), material)
    mesh.name = definition.name
    mesh.position.set(...definition.position)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)

    return { name: definition.name, type: definition.type, color: definition.color, mesh }
  })

  const resize = () => {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    camera.aspect = width / height
    const horizontalFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect)
    const distance = 12.2 / (2 * Math.tan(horizontalFov / 2) * 0.82)
    camera.position.set(0, lookTarget.y + distance * 0.34, distance)
    camera.lookAt(lookTarget)
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  resize()

  const setCameraTargetHeight = (height) => {
    lookTarget.y = height
    resize()
  }

  const markShadowsDirty = () => {
    renderer.shadowMap.needsUpdate = true
    scene.traverse((child) => {
      if (child.isLight && child.castShadow && child.shadow) child.shadow.needsUpdate = true
    })
  }

 

renderer.setAnimationLoop((time) => {
  const elapsed = time * 0.001

  scene.traverse((object) => {
    if (!object.userData.isButterfly) return

    const leftWing = object.getObjectByName('leftWing')
    const rightWing = object.getObjectByName('rightWing')

    const flap = Math.sin(elapsed * 8) * 0.65

    if (leftWing) leftWing.rotation.x = flap
    if (rightWing) rightWing.rotation.x = -flap
  })

  renderer.render(scene, camera)
})

  return {
    scene,
    camera,
    renderer,
    objects,
    setCameraTargetHeight,
    markShadowsDirty,
    initialLights: [
      { name: 'Key Directional', type: 'DIRECTIONAL', light: keyLight },
      { name: 'Fill Directional', type: 'DIRECTIONAL', light: fillLight },
    ],
    dispose() {
      resizeObserver.disconnect()
      renderer.setAnimationLoop(null)
      scene.traverse((child) => {
        if (child.geometry) child.geometry.dispose()
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
        else if (child.material) child.material.dispose()
      })
      renderer.dispose()
    },
  }
}