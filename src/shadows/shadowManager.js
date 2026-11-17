import * as THREE from 'three'

export class ShadowManager {
  constructor({ renderer, lightManager, markShadowsDirty }) {
    this.renderer = renderer
    this.lightManager = lightManager
    this.markShadowsDirty = markShadowsDirty
    this.enabled = true
    this.active = false
    this.resolution = 1024
    this.softness = 2.5
    this.shadowIntensity = 0.9

    this.sourceList = document.querySelector('#shadow-light-list')
    this.enabledToggle = document.querySelector('#shadows-enabled')
    this.qualityInput = document.querySelector('#shadow-quality')
    this.softnessInput = document.querySelector('#shadow-softness')
    this.softnessOutput = document.querySelector('#shadow-softness-value')

    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.shadowMap.autoUpdate = false
    this.configureAllLights()
    this.markShadowsDirty()
    this.bindEvents()
    this.renderSources()
  }

  bindEvents() {
    this.enabledToggle.addEventListener('click', () => {
      this.enabled = !this.enabled
      this.enabledToggle.setAttribute('aria-checked', String(this.enabled))
      this.renderer.shadowMap.enabled = this.enabled
      this.configureAllLights()
      this.markShadowsDirty()
      this.updateSummary()
    })

    this.qualityInput.addEventListener('change', () => {
      this.resolution = Number(this.qualityInput.value)
      for (const record of this.lightManager.records) this.disposeShadowTargets(record.light.shadow)
      this.configureAllLights()
      this.markShadowsDirty()
    })

    this.softnessInput.addEventListener('input', () => {
      this.softness = Number(this.softnessInput.value)
      this.softnessOutput.value = this.softness.toFixed(1)
      this.softnessOutput.textContent = this.softness.toFixed(1)
      this.configureAllLights()
      this.markShadowsDirty()
    })

    this.sourceList.addEventListener('change', (event) => {
      const input = event.target.closest('[data-shadow-light-id]')
      if (!input) return
      const record = this.lightManager.records.find((lightRecord) => lightRecord.id === input.dataset.shadowLightId)
      if (!record) return

      record.castShadow = input.checked
      record.light.castShadow = input.checked
      this.configureAllLights()
      this.markShadowsDirty()
      this.renderSources()
    })

    document.addEventListener('shadowlab:lights-changed', this.onLightsChanged)
  }

  onLightsChanged = () => {
    this.configureAllLights()
    this.renderSources()
  }

  configureAllLights() {
    for (const record of this.lightManager.records) this.configureLight(record.light)
  }

  configureLight(light) {
    if (!light.shadow) return

    const shadow = light.shadow
    shadow.mapSize.set(this.resolution, this.resolution)
    shadow.radius = this.softness
    shadow.bias = -0.00015
    shadow.normalBias = 0.025
    shadow.intensity = this.enabled && light.castShadow && light.visible ? this.shadowIntensity : 0
    shadow.autoUpdate = false

    if (light.isDirectionalLight) {
      Object.assign(shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 0.5, far: 40 })
      shadow.camera.updateProjectionMatrix()
    } else if (light.isSpotLight) {
      shadow.camera.near = 0.1
      shadow.camera.far = light.distance > 0 ? light.distance : 35
      shadow.camera.fov = THREE.MathUtils.radToDeg(light.angle * 2)
      shadow.camera.updateProjectionMatrix()
    } else if (light.isPointLight) {
      shadow.camera.near = 0.1
      shadow.camera.far = light.distance > 0 ? light.distance : 35
      shadow.camera.updateProjectionMatrix()
    }
  }

  disposeShadowTargets(shadow) {
    if (!shadow) return
    shadow.map?.dispose()
    shadow.mapPass?.dispose()
    shadow.map = null
    shadow.mapPass = null
  }

  setActive(active) {
    this.active = active
    if (active) {
      this.renderSources()
      this.updateSummary()
    }
  }

  renderSources() {
    this.sourceList.replaceChildren()

    for (const record of this.lightManager.records) {
      const row = document.createElement('label')
      row.className = 'shadow-source-row'

      const input = document.createElement('input')
      input.type = 'checkbox'
      input.checked = record.castShadow
      input.dataset.shadowLightId = record.id
      input.setAttribute('aria-label', `Cast shadows from ${record.name}`)

      const marker = document.createElement('span')
      marker.className = `light-swatch${record.enabled ? '' : ' is-disabled'}`
      marker.style.setProperty('--swatch-color', `#${record.light.color.getHexString()}`)
      marker.setAttribute('aria-hidden', 'true')

      const name = document.createElement('span')
      name.className = 'object-name'
      name.textContent = record.name

      const type = document.createElement('span')
      type.className = 'object-type'
      type.textContent = record.type

      row.append(input, marker, name, type)
      this.sourceList.append(row)
    }

    this.updateSummary()
  }

  updateSummary() {
    if (!this.active) return
    const casterCount = this.lightManager.records.filter((record) => record.castShadow && record.enabled).length
    const count = String(casterCount).padStart(2, '0')
    document.querySelector('#sidebar-count').textContent = count
    document.querySelector('#shadow-list-count').textContent = `${count} CASTERS`
    document.querySelector('#scene-status-label').textContent = 'SHADOWS'
    document.querySelector('#scene-status-count').textContent = this.enabled ? `${casterCount} CASTERS` : 'OFF'
    document.querySelector('#shadow-state').textContent = this.enabled ? 'ON' : 'OFF'
  }

  dispose() {
    document.removeEventListener('shadowlab:lights-changed', this.onLightsChanged)
  }
}