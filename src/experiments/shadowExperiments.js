const HEIGHT_DEFAULT = 6.5
const EXPERIMENTS = ['overlap', 'lights', 'height', 'rotation']

function snapshotTransform(record) {
  return {
    position: record.mesh.position.clone(),
    rotation: record.mesh.rotation.clone(),
    scale: record.mesh.scale.clone(),
  }
}

export class ShadowExperiments {
  constructor({ scene, objectEditor, lightManager, shadowManager, markShadowsDirty }) {
    this.objectEditor = objectEditor
    this.objectManager = objectEditor.objectManager
    this.lightManager = lightManager
    this.shadowManager = shadowManager
    this.markShadowsDirty = markShadowsDirty
    this.active = false
    this.currentExperiment = null
    this.previousShadowEnabled = null
    this.objectBaseline = new Map()
    this.objectBaselineIds = new Set()
    this.lightBaseline = []
    this.heightLightId = null
    this.heightLightBaseline = null
    this.heightHemisphereLight = scene.children.find((child) => child.isHemisphereLight) ?? null
    this.heightHemisphereIntensity = null

    this.panel = document.querySelector('#experiment-mode-panel')
    this.objectModePanel = document.querySelector('#object-mode-panel')
    this.lightingModePanel = document.querySelector('#lighting-mode-panel')
    this.shadowModePanel = document.querySelector('#shadow-mode-panel')
    this.objectInspectorPanel = document.querySelector('#object-inspector-panel')
    this.lightInspectorPanel = document.querySelector('#light-inspector-panel')
    this.shadowInspectorPanel = document.querySelector('#shadow-inspector-panel')
    this.objectInspectorActions = document.querySelector('#object-inspector-actions')
    this.lightInspectorActions = document.querySelector('#light-inspector-actions')
    this.materialInspectorActions = document.querySelector('#material-inspector-actions')
    this.rotationObject = document.querySelector('#experiment-rotation-object')
    this.rotationAxis = document.querySelector('#experiment-rotation-axis')
    this.rotationAngle = document.querySelector('#experiment-rotation-angle')
    this.rotationAngleValue = document.querySelector('#experiment-rotation-angle-value')
    this.heightInput = document.querySelector('#experiment-light-height')
    this.heightValue = document.querySelector('#experiment-light-height-value')

    this.bindEvents()
    this.syncRotationObjects()
  }

  bindEvents() {
    this.panel.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-experiment-tab]')
      if (tab && this.active) this.activateExperiment(tab.dataset.experimentTab)

      const reset = event.target.closest('[data-experiment-reset]')
      if (reset && this.active) this.resetExperiment(reset.dataset.experimentReset)
    })

    this.heightInput.addEventListener('input', () => this.setHeight(Number(this.heightInput.value)))
    this.rotationObject.addEventListener('change', () => {
      if (this.rotationObject.value) this.objectEditor.select(this.rotationObject.value)
    })
    this.rotationAxis.addEventListener('change', () => this.syncRotationAngle())
    this.rotationAngle.addEventListener('input', () => this.setRotation(Number(this.rotationAngle.value)))

    document.addEventListener('shadowlab:object-selection-changed', this.onObjectSelectionChanged)
    document.addEventListener('shadowlab:object-removed', this.onObjectRemoved)
    document.addEventListener('shadowlab:lights-changed', this.onLightsChanged)
  }

  setActive(active) {
    if (active === this.active) return
    this.active = active

    if (active) {
      this.previousShadowEnabled = this.shadowManager.enabled
      this.shadowManager.setEnabled(true)
      this.activateExperiment(this.currentExperiment || 'overlap')
      return
    }

    this.removeHeightLight()
    this.objectEditor.setActive(false)
    this.lightManager.setActive(false)
    if (this.previousShadowEnabled !== null) this.shadowManager.setEnabled(this.previousShadowEnabled)
    this.previousShadowEnabled = null
  }

  activateExperiment(name) {
    if (!EXPERIMENTS.includes(name) || name === this.currentExperiment) return
    if (this.currentExperiment === 'height') this.removeHeightLight()

    this.currentExperiment = name
    this.panel.querySelectorAll('[data-experiment-tab]').forEach((tab) => {
      const selected = tab.dataset.experimentTab === name
      tab.classList.toggle('is-active', selected)
      tab.setAttribute('aria-selected', String(selected))
    })
    this.panel.querySelectorAll('[data-experiment-panel]').forEach((section) => {
      section.hidden = section.dataset.experimentPanel !== name
    })

    const usesObjects = name !== 'lights'
    const usesLights = name === 'lights'
    this.objectModePanel.hidden = !usesObjects
    this.lightingModePanel.hidden = !usesLights
    this.shadowModePanel.hidden = true
    this.objectInspectorPanel.hidden = !usesObjects
    this.lightInspectorPanel.hidden = !usesLights
    this.shadowInspectorPanel.hidden = true
    this.objectInspectorActions.hidden = true
    this.lightInspectorActions.hidden = true
    this.materialInspectorActions.hidden = true
    document.querySelector('#inspector-heading').textContent = usesLights ? 'Lighting Setup' : 'Object Study'
    document.querySelector('.project-state').lastChild.textContent =
      ` ${this.panel.querySelector(`[data-experiment-tab="${name}"]`).textContent.toUpperCase()}`

    this.objectEditor.select(null)
    this.lightManager.select(null)
    this.objectEditor.setActive(usesObjects)
    this.lightManager.setActive(usesLights)

    if (name === 'overlap' || name === 'rotation') this.captureObjectBaseline()
    if (name === 'lights') this.captureLightBaseline()
    if (name === 'height') this.addHeightLight()
    if (name === 'rotation') {
      this.syncRotationObjects()
      const preferred = this.objectManager.records.find((record) => record.name === 'Cube')
        ?? this.objectManager.records[0]
      if (preferred) this.objectEditor.select(preferred.id)
    }
    this.updateReadouts()
  }

  captureObjectBaseline() {
    this.objectBaseline.clear()
    this.objectBaselineIds.clear()
    for (const record of this.objectManager.records) {
      this.objectBaseline.set(record.id, snapshotTransform(record))
      this.objectBaselineIds.add(record.id)
    }
  }

  captureLightBaseline() {
    this.lightBaseline = this.lightManager.records.map((record) => ({
      id: record.id,
      record,
      position: record.light.position.clone(),
      targetPosition: record.light.target?.position.clone() ?? null,
      color: `#${record.light.color.getHexString()}`,
      intensity: record.light.intensity,
      enabled: record.enabled,
      castShadow: record.castShadow,
    }))
  }

  addHeightLight() {
    this.heightLightBaseline = new Map(this.lightManager.records.map((record) => [
      record.id,
      {
        visible: record.light.visible,
        intensity: record.light.intensity,
        castShadow: record.castShadow,
      },
    ]))
    this.heightHemisphereIntensity = this.heightHemisphereLight?.intensity ?? null
    const record = this.lightManager.add('spot')
    if (!record) throw new Error('Unable to create the height experiment spotlight.')

    record.name = 'Height Study Spotlight'
    record.light.name = record.name
    record.light.position.set(-3, HEIGHT_DEFAULT, -4)
    record.light.target.position.set(0, 0.85, 0)
    record.light.target.updateMatrixWorld()
    record.light.angle = Math.PI / 5
    record.light.distance = 30
    record.light.intensity = 120
    this.heightLightId = record.id

    for (const lightRecord of this.lightManager.records) {
      lightRecord.light.visible = lightRecord.id === record.id
      lightRecord.castShadow = lightRecord.id === record.id
      lightRecord.light.castShadow = lightRecord.castShadow
    }
    if (this.heightHemisphereLight) this.heightHemisphereLight.intensity = 0.35

    this.heightInput.value = String(HEIGHT_DEFAULT)
    this.setHeight(HEIGHT_DEFAULT)
    this.lightManager.renderList()
    for (const lightRecord of this.lightManager.records) this.lightManager.updateIndicator(lightRecord)
    this.shadowManager.configureAllLights()
    this.markShadowsDirty()
  }

  setHeight(height) {
    const record = this.lightManager.records.find((lightRecord) => lightRecord.id === this.heightLightId)
    if (!record || !Number.isFinite(height)) return
    record.light.position.y = height
    this.heightValue.value = height.toFixed(1)
    this.heightValue.textContent = height.toFixed(1)
    this.markShadowsDirty()
  }

  removeHeightLight() {
    if (!this.heightLightId) return
    this.lightManager.remove(this.heightLightId)
    this.heightLightId = null

    if (this.heightLightBaseline) {
      for (const record of this.lightManager.records) {
        const baseline = this.heightLightBaseline.get(record.id)
        if (!baseline) continue
        record.light.visible = baseline.visible
        record.light.intensity = baseline.intensity
        record.castShadow = baseline.castShadow
        record.light.castShadow = baseline.castShadow
        this.lightManager.updateIndicator(record)
      }
    }

    if (this.heightHemisphereLight && this.heightHemisphereIntensity !== null) {
      this.heightHemisphereLight.intensity = this.heightHemisphereIntensity
    }
    this.heightLightBaseline = null
    this.heightHemisphereIntensity = null
    this.lightManager.renderList()
    this.shadowManager.configureAllLights()
    this.markShadowsDirty()
  }

  syncRotationObjects() {
    const selectedId = this.objectEditor.selected?.id ?? this.rotationObject.value
    this.rotationObject.replaceChildren()

    for (const record of this.objectManager.records) {
      const option = document.createElement('option')
      option.value = record.id
      option.textContent = record.name
      this.rotationObject.append(option)
    }

    if (this.objectManager.get(selectedId)) this.rotationObject.value = selectedId
    this.rotationObject.disabled = this.objectManager.records.length === 0
    this.rotationAngle.disabled = this.rotationObject.disabled
    this.syncRotationAngle()
  }

  syncRotationAngle() {
    const record = this.objectManager.get(this.rotationObject.value)
    const axis = this.rotationAxis.value
    const angle = record ? record.mesh.rotation[axis] * (180 / Math.PI) : 0
    const normalizedAngle = ((angle % 360) + 360) % 360
    this.rotationAngle.value = String(Math.round(normalizedAngle))
    this.rotationAngleValue.value = `${Math.round(normalizedAngle)}°`
    this.rotationAngleValue.textContent = `${Math.round(normalizedAngle)}°`
  }

  setRotation(angle) {
    const record = this.objectManager.get(this.rotationObject.value)
    if (!record || !Number.isFinite(angle)) return
    if (this.objectEditor.selected?.id !== record.id) this.objectEditor.select(record.id)
    record.mesh.rotation[this.rotationAxis.value] = angle * (Math.PI / 180)
    this.objectEditor.selectionOutline?.update()
    this.objectEditor.syncProperties()
    this.rotationAngleValue.value = `${Math.round(angle)}°`
    this.rotationAngleValue.textContent = `${Math.round(angle)}°`
    this.markShadowsDirty()
  }

  onObjectSelectionChanged = (event) => {
    const record = event.detail.record
    if (record && (this.currentExperiment === 'overlap' || this.currentExperiment === 'rotation')
      && !this.objectBaseline.has(record.id)) {
      this.objectBaseline.set(record.id, snapshotTransform(record))
    }
    this.syncRotationObjects()
    this.updateReadouts()
  }

  onObjectRemoved = (event) => {
    if (event.detail.record) this.objectBaseline.delete(event.detail.record.id)
    this.syncRotationObjects()
    this.updateReadouts()
  }

  onLightsChanged = () => this.updateReadouts()

  updateReadouts() {
    if (!this.active) return
    const experimentNumber = EXPERIMENTS.indexOf(this.currentExperiment) + 1
    document.querySelector('#sidebar-count').textContent = '04'
    document.querySelector('.count-badge').textContent = '04'
    document.querySelector('#scene-status-label').textContent = 'EXPERIMENTS'
    document.querySelector('#scene-status-count').textContent = `${experimentNumber} / 4 STUDIES`
  }

  restoreObjectTransforms() {
    this.objectEditor.select(null)
    for (const record of [...this.objectManager.records]) {
      if (this.objectBaselineIds.has(record.id)) continue
      const removed = this.objectManager.remove(record.id)
      document.dispatchEvent(new CustomEvent('shadowlab:object-removed', { detail: { record: removed } }))
    }

    for (const [id, transform] of this.objectBaseline) {
      const record = this.objectManager.get(id)
      if (!record) continue
      record.mesh.position.copy(transform.position)
      record.mesh.rotation.copy(transform.rotation)
      record.mesh.scale.copy(transform.scale)
    }
    this.objectEditor.renderList()
    this.objectEditor.selectionOutline?.update()
    this.objectEditor.syncProperties()
    this.syncRotationAngle()
    this.markShadowsDirty()
    this.updateReadouts()
  }

  restoreLights() {
    this.lightManager.select(null)
    const baselineIds = new Set(this.lightBaseline.map((snapshot) => snapshot.id))
    for (const record of [...this.lightManager.records]) {
      if (!baselineIds.has(record.id)) this.lightManager.remove(record.id)
    }

    for (const snapshot of this.lightBaseline) {
      const record = this.lightManager.records.find((lightRecord) => lightRecord.id === snapshot.id)
      if (!record) continue
      record.light.position.copy(snapshot.position)
      if (snapshot.targetPosition && record.light.target) {
        record.light.target.position.copy(snapshot.targetPosition)
        record.light.target.updateMatrixWorld()
      }
      record.light.color.set(snapshot.color)
      record.light.intensity = snapshot.intensity
      record.enabled = snapshot.enabled
      record.light.visible = snapshot.enabled
      record.castShadow = snapshot.castShadow
      record.light.castShadow = snapshot.castShadow
      this.lightManager.updateIndicator(record)
    }

    this.lightManager.renderList()
    this.shadowManager.configureAllLights()
    this.markShadowsDirty()
    this.updateReadouts()
  }

  resetExperiment(name) {
    if (name !== this.currentExperiment) return
    if (name === 'overlap' || name === 'rotation') this.restoreObjectTransforms()
    else if (name === 'lights') this.restoreLights()
    else if (name === 'height') {
      this.heightInput.value = String(HEIGHT_DEFAULT)
      this.setHeight(HEIGHT_DEFAULT)
    }
    this.updateReadouts()
  }
}
