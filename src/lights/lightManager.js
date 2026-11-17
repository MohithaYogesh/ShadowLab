import * as THREE from 'three'

const LIGHT_TYPES = {
  point: { label: 'Point', type: 'POINT', color: '#ffc978', intensity: 55 },
  directional: { label: 'Directional', type: 'DIRECTIONAL', color: '#d9e8ff', intensity: 1.6 },
  spot: { label: 'Spotlight', type: 'SPOT', color: '#ffe1a5', intensity: 90 },
}

function colorValue(color) {
  return `#${color.getHexString()}`
}

function setLightColor(light, color) {
  light.color.set(color)
  if (light.isSpotLight) light.target.updateMatrixWorld()
}

export class LightManager {
  constructor({ scene, renderer, initialLights = [], markShadowsDirty = () => {} }) {
    this.scene = scene
    this.renderer = renderer
    this.markShadowsDirty = markShadowsDirty
    this.records = []
    this.selected = null
    this.active = false
    this.nextId = 1

    this.lightList = document.querySelector('#light-list')
    this.lightTools = document.querySelector('#light-tools')
    this.properties = document.querySelector('#light-properties')
    this.inspectorEmpty = document.querySelector('#light-inspector-empty')
    this.removeButton = document.querySelector('#remove-light')

    for (const source of initialLights) {
      source.light.target.position.set(0, 0, 0)
      scene.add(source.light.target)
      this.records.push(this.track(source.light, source.type, source.name))
    }

    this.bindEvents()
    this.renderList()
  }

  track(light, type, name) {
    const record = {
      id: `light-${this.nextId++}`,
      name,
      type,
      light,
      enabled: light.visible,
      castShadow: light.castShadow,
      indicator: null,
    }
    light.name = name
    light.userData.shadowLabLightId = record.id
    this.createIndicator(record)
    return record
  }

  createIndicator(record) {
    const color = record.light.color
    if (record.light.isPointLight) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 12),
        new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      )
      marker.renderOrder = 30
      record.indicator = marker
    } else {
      const direction = record.light.target.position.clone().sub(record.light.position).normalize()
      record.indicator = new THREE.ArrowHelper(direction, record.light.position, 1.35, color, 0.3, 0.17)
      record.indicator.renderOrder = 30
    }
    record.indicator.visible = false
    record.indicator.userData.shadowLabIndicatorId = record.id
    this.scene.add(record.indicator)
    this.updateIndicator(record)
  }

  bindEvents() {
    this.lightTools.addEventListener('click', (event) => {
      const button = event.target.closest('[data-add-light]')
      if (!button) return
      const record = this.add(button.dataset.addLight)
      if (record) this.select(record.id)
    })

    this.removeButton.addEventListener('click', () => {
      if (!this.selected) return
      const id = this.selected.id
      this.select(null)
      this.remove(id)
    })

    this.lightList.addEventListener('click', (event) => {
      const row = event.target.closest('[data-light-id]')
      if (row) this.select(row.dataset.lightId)
    })

    this.properties.addEventListener('input', (event) => this.onPropertyInput(event))
    this.properties.addEventListener('change', (event) => {
      if (event.target.matches('[data-light-property]')) this.syncProperties()
    })
    document.querySelector('#light-enabled').addEventListener('change', (event) => {
      if (!this.selected) return
      this.selected.enabled = event.currentTarget.checked
      this.selected.light.visible = this.selected.enabled
      this.updateIndicator(this.selected)
      this.markShadowsDirty()
      this.renderList()
    })
  }

  add(kind) {
    const definition = LIGHT_TYPES[kind]
    if (!definition) return null

    const count = this.records.filter((record) => record.type === definition.type).length
    const name = `${definition.label} ${count + 1}`
    let light
    if (kind === 'point') {
      light = new THREE.PointLight(definition.color, definition.intensity, 22, 2)
      light.position.set(-2.8 + (count % 3) * 2.8, 4.8, 3.2)
    } else if (kind === 'directional') {
      light = new THREE.DirectionalLight(definition.color, definition.intensity)
      light.position.set(-5 + (count % 3) * 4, 7, 5)
      light.target.position.set(0, 0.5, 0)
      this.scene.add(light.target)
    } else {
      light = new THREE.SpotLight(definition.color, definition.intensity, 24, Math.PI / 5, 0.35, 2)
      light.position.set(0, 7, 5)
      light.target.position.set(0, 0.5, 0)
      this.scene.add(light.target)
    }

    light.castShadow = true
    this.scene.add(light)
    const record = this.track(light, definition.type, name)
    this.records.push(record)
    this.markShadowsDirty()
    this.renderList()
    return record
  }

  select(id) {
    this.selected = id ? this.records.find((record) => record.id === id) ?? null : null

    for (const record of this.records) this.updateIndicator(record)

    this.inspectorEmpty.hidden = Boolean(this.selected)
    this.properties.hidden = !this.selected
    this.removeButton.disabled = !this.selected
    this.syncProperties()
    this.renderList()
  }

  setActive(active) {
    this.active = active
    for (const record of this.records) this.updateIndicator(record)
  }

  updateIndicator(record) {
    const { light, indicator } = record
    const enabled = record.enabled && light.visible
    indicator.visible = this.active && enabled

    if (light.isPointLight) {
      indicator.position.copy(light.position)
      indicator.scale.setScalar(record === this.selected ? 1.55 : 1)
      indicator.material.color.copy(record === this.selected ? new THREE.Color('#c0dc6b') : light.color)
      return
    }

    const direction = light.target.position.clone().sub(light.position)
    if (direction.lengthSq() < 0.0001) direction.set(0, -1, 0)
    direction.normalize()
    indicator.position.copy(light.position)
    indicator.setDirection(direction)
    indicator.setLength(record === this.selected ? 1.75 : 1.35, 0.34, 0.2)
    indicator.line.material.color.copy(record === this.selected ? new THREE.Color('#c0dc6b') : light.color)
    indicator.cone.material.color.copy(record === this.selected ? new THREE.Color('#c0dc6b') : light.color)
  }

  renderList() {
    this.lightList.replaceChildren()

    for (const record of this.records) {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'light-item'
      row.dataset.lightId = record.id
      row.setAttribute('aria-pressed', String(record.id === this.selected?.id))
      row.setAttribute('aria-label', `${record.name}, ${record.type.toLowerCase()}${record.enabled ? '' : ', disabled'}`)

      const swatch = document.createElement('span')
      swatch.className = `light-swatch${record.enabled ? '' : ' is-disabled'}`
      swatch.style.setProperty('--swatch-color', colorValue(record.light.color))
      swatch.setAttribute('aria-hidden', 'true')

      const name = document.createElement('span')
      name.className = 'object-name'
      name.textContent = record.name

      const type = document.createElement('span')
      type.className = 'object-type'
      type.textContent = record.type

      row.append(swatch, name, type)
      this.lightList.append(row)
    }

    const count = String(this.records.length).padStart(2, '0')
    document.querySelector('#sidebar-count').textContent = count
    document.querySelector('#list-count').textContent = `${count} LIGHTS`
    document.querySelector('#scene-status-label').textContent = 'LIGHTS'
    document.querySelector('#scene-status-count').textContent = `${this.records.length} SOURCES`
    document.dispatchEvent(new Event('shadowlab:lights-changed'))
  }

  onPropertyInput(event) {
    if (!this.selected) return
    const input = event.target

    if (input.matches('[data-light-property]')) {
      if (input.value.trim() === '') return
      const value = Number(input.value)
      if (!Number.isFinite(value)) return

      if (input.dataset.lightProperty === 'intensity') {
        this.selected.light.intensity = Math.max(0, value)
      } else {
        this.selected.light.position[input.dataset.axis] = value
        this.markShadowsDirty()
      }
      this.updateIndicator(this.selected)
      this.syncProperties(input)
      return
    }

    if (input.matches('#light-color')) {
      setLightColor(this.selected.light, input.value)
      this.updateIndicator(this.selected)
      const swatch = this.lightList.querySelector(`[data-light-id="${this.selected.id}"] .light-swatch`)
      swatch?.style.setProperty('--swatch-color', input.value)
    }
  }

  syncProperties(activeInput = null) {
    if (!this.selected) return

    const { light } = this.selected
    document.querySelector('#selected-light-name').textContent = this.selected.name
    document.querySelector('#selected-light-type').textContent = this.selected.type
    document.querySelector('#light-color').value = colorValue(light.color)
    document.querySelector('#light-enabled').checked = this.selected.enabled
    this.properties.querySelectorAll('[data-light-property]').forEach((input) => {
      if (input === activeInput) return
      const value = input.dataset.lightProperty === 'intensity'
        ? light.intensity
        : light.position[input.dataset.axis]
      input.value = Number(value.toFixed(3)).toString()
    })
  }

  remove(id) {
    const index = this.records.findIndex((record) => record.id === id)
    if (index < 0) return null

    const [record] = this.records.splice(index, 1)
    this.scene.remove(record.light)
    if (record.light.target) this.scene.remove(record.light.target)
    this.scene.remove(record.indicator)
    this.disposeIndicator(record.indicator)
    record.light.shadow?.map?.dispose()
    record.light.shadow?.mapPass?.dispose()
    if (record.light.shadow) {
      record.light.shadow.map = null
      record.light.shadow.mapPass = null
    }
    this.markShadowsDirty()
    this.renderList()
    return record
  }

  disposeIndicator(indicator) {
    indicator.traverse((child) => {
      child.geometry?.dispose()
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
      else child.material?.dispose()
    })
  }

  dispose() {
    this.select(null)
    this.setActive(false)
    for (const record of [...this.records]) this.remove(record.id)
  }
}