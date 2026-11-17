import * as THREE from 'three'
import { gouraudFragmentShader, gouraudVertexShader } from './shaders/gouraud.js'
import { phongFragmentShader, phongVertexShader } from './shaders/phong.js'

const MAX_LIGHTS = 8
const TECHNIQUES = ['flat', 'smooth', 'gouraud', 'phong']
const TECHNIQUE_LABELS = {
  flat: 'Flat',
  smooth: 'Smooth',
  gouraud: 'Gouraud',
  phong: 'Phong',
}
const MATERIAL_PRESETS = {
  plastic: { roughness: 0.28, metalness: 0, opacity: 1, specular: '#eeeeee' },
  metallic: { roughness: 0.24, metalness: 0.78, opacity: 1, specular: null },
  glass: { roughness: 0.08, metalness: 0, opacity: 0.48, specular: '#f4f8ff' },
  matte: { roughness: 0.92, metalness: 0, opacity: 1, specular: '#777777' },
}

function makeDefaultSettings(color) {
  return {
    technique: 'smooth',
    materialType: 'plastic',
    color,
    ambient: 0.35,
    diffuse: 1,
    specular: 0.65,
    shininess: 48,
  }
}

function disposeMaterial(material) {
  if (Array.isArray(material)) material.forEach((part) => part.dispose())
  else material?.dispose()
}

function makeUniforms(settings) {
  return {
    uLightCount: { value: 0 },
    uLightPositions: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
    uLightDirections: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, -1, 0)) },
    uLightColors: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
    uLightIntensities: { value: new Float32Array(MAX_LIGHTS) },
    uLightRanges: { value: new Float32Array(MAX_LIGHTS) },
    uLightInnerCosines: { value: new Float32Array(MAX_LIGHTS) },
    uLightOuterCosines: { value: new Float32Array(MAX_LIGHTS) },
    uLightTypes: { value: new Int32Array(MAX_LIGHTS) },
    uMaterialColor: { value: new THREE.Color(settings.color) },
    uAmbientComponent: { value: settings.ambient },
    uDiffuseComponent: { value: settings.diffuse },
    uSpecularComponent: { value: settings.specular },
    uShininess: { value: settings.shininess },
    uRoughness: { value: MATERIAL_PRESETS[settings.materialType].roughness },
    uMetalness: { value: MATERIAL_PRESETS[settings.materialType].metalness },
    uOpacity: { value: MATERIAL_PRESETS[settings.materialType].opacity },
  }
}

export class MaterialLab {
  constructor({ scene, renderer, objectEditor, lightManager, markShadowsDirty }) {
    this.scene = scene
    this.renderer = renderer
    this.objectEditor = objectEditor
    this.objectManager = objectEditor.objectManager
    this.lightManager = lightManager
    this.markShadowsDirty = markShadowsDirty
    this.selected = null
    this.settingsById = new Map()
    this.baseColorById = new Map()
    this.appliedMaterials = new Map()
    this.originalRenderCallbacks = new Map()
    this.comparisonActive = false
    this.comparisonRecord = null
    this.comparisonOriginalVisible = true
    this.comparisonMeshes = []
    this.temporaryMaterials = []
    this.lightPosition = new THREE.Vector3()
    this.lightTarget = new THREE.Vector3()
    this.lightDirection = new THREE.Vector3()

    this.panel = document.querySelector('#material-inspector-panel')
    this.empty = document.querySelector('#material-inspector-empty')
    this.properties = document.querySelector('#material-properties')
    this.compareButton = document.querySelector('#material-compare')
    this.resetButton = document.querySelector('#material-reset')
    this.legend = document.querySelector('#material-comparison-legend')
    this.objectManagerPanel = document.querySelector('#object-mode-panel')

    this.bindEvents()
    this.syncSelection(null)
  }

  bindEvents() {
    document.addEventListener('shadowlab:object-selection-changed', this.onSelectionChanged)
    document.addEventListener('shadowlab:object-removed', this.onObjectRemoved)

    this.properties.addEventListener('input', (event) => this.onInput(event))
    this.properties.addEventListener('change', (event) => this.onInput(event))

    this.compareButton.addEventListener('click', () => {
      if (!this.selected) return
      if (this.comparisonActive) this.stopComparison()
      else this.startComparison()
    })

    this.resetButton.addEventListener('click', () => this.resetSelected())
    document.querySelectorAll('[data-shading-technique]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!this.selected) return
        this.settingsFor(this.selected).technique = button.dataset.shadingTechnique
        this.applySelected()
      })
    })
  }

  onSelectionChanged = (event) => {
    this.syncSelection(event.detail.record)
  }

  onObjectRemoved = (event) => {
    const record = event.detail.record
    if (!record) return
    this.settingsById.delete(record.id)
    this.baseColorById.delete(record.id)
    this.appliedMaterials.delete(record.id)
    this.originalRenderCallbacks.delete(record.id)
  }

  settingsFor(record) {
    if (!this.settingsById.has(record.id)) {
      this.baseColorById.set(record.id, record.color)
      this.settingsById.set(record.id, makeDefaultSettings(record.color))
    }
    return this.settingsById.get(record.id)
  }

  syncSelection(record) {
    if (this.comparisonActive) this.stopComparison()
    this.selected = record
    this.empty.hidden = Boolean(record)
    this.properties.hidden = !record
    this.compareButton.disabled = !record
    this.resetButton.disabled = !record

    if (!record) return

    this.applySelected()
    this.syncControls()
  }

  syncControls() {
    if (!this.selected) return
    const settings = this.settingsFor(this.selected)
    document.querySelector('#material-target-name').textContent = this.selected.name
    document.querySelector('#material-target-type').textContent = this.selected.type
    document.querySelector('#lab-material-color').value = settings.color
    document.querySelector('#material-type').value = settings.materialType

    for (const key of ['ambient', 'diffuse', 'specular', 'shininess']) {
      const input = document.querySelector(`#material-${key}`)
      const output = document.querySelector(`#material-${key}-value`)
      input.value = String(settings[key])
      output.value = String(settings[key])
      output.textContent = String(settings[key])
    }

    document.querySelectorAll('[data-shading-technique]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.shadingTechnique === settings.technique))
    })
  }

  onInput(event) {
    if (!this.selected) return
    const input = event.target
    const settings = this.settingsFor(this.selected)

    if (input.matches('#material-type')) {
      settings.materialType = input.value
    } else if (input.matches('#lab-material-color')) {
      settings.color = input.value
      this.selected.color = input.value
      const swatch = document.querySelector(`[data-object-id="${this.selected.id}"] .object-swatch`)
      swatch?.style.setProperty('--swatch-color', input.value)
    } else if (input.matches('[data-material-component]')) {
      settings[input.dataset.materialComponent] = Number(input.value)
      const output = document.querySelector(`#material-${input.dataset.materialComponent}-value`)
      output.value = input.value
      output.textContent = input.value
    } else {
      return
    }

    this.applySelected()
  }

  applySelected() {
    if (!this.selected) return
    const settings = this.settingsFor(this.selected)
    const replacement = this.createMaterial(settings)
    const previous = this.selected.mesh.material
    const previousApplied = this.appliedMaterials.get(this.selected.id)
    this.selected.mesh.material = replacement
    this.appliedMaterials.set(this.selected.id, replacement)

    if (!this.originalRenderCallbacks.has(this.selected.id)) {
      this.originalRenderCallbacks.set(this.selected.id, this.selected.mesh.onBeforeRender)
    }

    if (replacement.isShaderMaterial) {
      this.selected.mesh.onBeforeRender = () => this.updateLightUniforms(replacement)
    } else {
      this.selected.mesh.onBeforeRender = this.originalRenderCallbacks.get(this.selected.id)
    }

    if (previousApplied) disposeMaterial(previousApplied)
    else disposeMaterial(previous)

    this.syncControls()
    if (this.comparisonActive) this.refreshComparison()
  }

  createMaterial(settings) {
    const preset = MATERIAL_PRESETS[settings.materialType]
    const color = new THREE.Color(settings.color)
    const diffuseColor = color.clone().multiplyScalar(settings.diffuse)
    const emissiveColor = color.clone().multiplyScalar(settings.ambient * 0.12)
    const metalSpecular = color.clone().multiplyScalar(settings.specular)
    const plasticSpecular = new THREE.Color('#eeeeee').multiplyScalar(settings.specular)
    const specularColor = settings.materialType === 'metallic' ? metalSpecular : preset.specular ? new THREE.Color(preset.specular).multiplyScalar(settings.specular) : plasticSpecular

    if (settings.technique === 'gouraud' || settings.technique === 'phong') {
      return this.createShaderMaterial(settings, preset)
    }

    if (settings.materialType === 'glass') {
      return new THREE.MeshPhysicalMaterial({
        color: diffuseColor,
        emissive: emissiveColor,
        roughness: preset.roughness,
        metalness: preset.metalness,
        clearcoat: settings.specular,
        clearcoatRoughness: preset.roughness,
        opacity: preset.opacity,
        transparent: true,
        transmission: 0.05,
        thickness: 0.6,
        ior: 1.45,
        depthWrite: false,
        side: THREE.DoubleSide,
        flatShading: settings.technique === 'flat',
      })
    }

    const material = new THREE.MeshPhongMaterial({
      color: diffuseColor,
      emissive: emissiveColor,
      specular: specularColor,
      shininess: Math.max(1, settings.shininess * (1 - preset.roughness * 0.7)),
      flatShading: settings.technique === 'flat',
    })
    material.name = `${TECHNIQUE_LABELS[settings.technique]} ${settings.materialType}`
    return material
  }

  createShaderMaterial(settings, preset) {
    const uniforms = makeUniforms(settings)
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: settings.technique === 'gouraud' ? gouraudVertexShader : phongVertexShader,
      fragmentShader: settings.technique === 'gouraud' ? gouraudFragmentShader : phongFragmentShader,
      transparent: preset.opacity < 1,
      depthWrite: preset.opacity >= 1,
      side: settings.materialType === 'glass' ? THREE.DoubleSide : THREE.FrontSide,
      toneMapped: true,
    })
    material.name = `${TECHNIQUE_LABELS[settings.technique]} ${settings.materialType}`
    return material
  }

  updateLightUniforms(material) {
    const records = this.lightManager.records.filter((record) => record.enabled && record.light.visible).slice(0, MAX_LIGHTS)
    const uniforms = material.uniforms
    uniforms.uLightCount.value = records.length
    uniforms.uLightIntensities.value.fill(0)
    uniforms.uLightRanges.value.fill(0)
    uniforms.uLightInnerCosines.value.fill(1)
    uniforms.uLightOuterCosines.value.fill(1)
    uniforms.uLightTypes.value.fill(0)

    records.forEach((record, index) => {
      const light = record.light
      light.getWorldPosition(this.lightPosition)
      uniforms.uLightPositions.value[index].copy(this.lightPosition)
      uniforms.uLightColors.value[index].set(light.color.r, light.color.g, light.color.b)
      uniforms.uLightIntensities.value[index] = light.intensity
      uniforms.uLightRanges.value[index] = light.distance ?? 0

      if (light.isDirectionalLight) {
        light.target.getWorldPosition(this.lightTarget)
        this.lightDirection.subVectors(this.lightTarget, this.lightPosition).normalize()
        uniforms.uLightTypes.value[index] = 1
      } else if (light.isSpotLight) {
        light.target.getWorldPosition(this.lightTarget)
        this.lightDirection.subVectors(this.lightTarget, this.lightPosition).normalize()
        uniforms.uLightTypes.value[index] = 2
        uniforms.uLightInnerCosines.value[index] = Math.cos(light.angle * (1 - light.penumbra))
        uniforms.uLightOuterCosines.value[index] = Math.cos(light.angle)
      } else {
        this.lightDirection.set(0, -1, 0)
      }

      uniforms.uLightDirections.value[index].copy(this.lightDirection)
    })
  }

  resetSelected() {
    if (!this.selected) return
    this.settingsById.set(this.selected.id, makeDefaultSettings(this.baseColorById.get(this.selected.id) ?? this.selected.color))
    this.applySelected()
  }

  startComparison() {
    if (!this.selected || this.comparisonActive) return
    this.comparisonActive = true
    this.comparisonRecord = this.selected
    this.comparisonOriginalVisible = this.selected.mesh.visible
    this.selected.mesh.visible = false
    this.comparisonHiddenMeshes = this.objectManager.records
      .filter((record) => record.id !== this.selected.id && record.mesh.visible)
      .map((record) => record.mesh)
    for (const mesh of this.comparisonHiddenMeshes) mesh.visible = false
    this.objectEditor.transformHelper.visible = false
    if (this.objectEditor.selectionOutline) this.objectEditor.selectionOutline.visible = false
    this.compareButton.setAttribute('aria-pressed', 'true')
    this.compareButton.textContent = 'Exit comparison'
    this.legend.hidden = false
    this.refreshComparison()
  }

  refreshComparison() {
    this.clearComparisonMeshes()
    if (!this.comparisonRecord) return
    const settings = this.settingsFor(this.comparisonRecord)
    const xPositions = [-3.6, -1.2, 1.2, 3.6]

    TECHNIQUES.forEach((technique, index) => {
      const material = this.createMaterial({ ...settings, technique })
      const mesh = new THREE.Mesh(this.comparisonRecord.mesh.geometry, material)
      mesh.position.copy(this.comparisonRecord.mesh.position)
      mesh.position.x = xPositions[index]
      mesh.rotation.copy(this.comparisonRecord.mesh.rotation)
      mesh.scale.copy(this.comparisonRecord.mesh.scale).multiplyScalar(0.76)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.name = `${this.comparisonRecord.name} / ${TECHNIQUE_LABELS[technique]}`
      if (material.isShaderMaterial) mesh.onBeforeRender = () => this.updateLightUniforms(material)
      this.scene.add(mesh)
      this.comparisonMeshes.push(mesh)
      this.temporaryMaterials.push(material)
    })

    this.markShadowsDirty()
  }

  clearComparisonMeshes() {
    for (const mesh of this.comparisonMeshes) this.scene.remove(mesh)
    for (const material of this.temporaryMaterials) disposeMaterial(material)
    this.comparisonMeshes = []
    this.temporaryMaterials = []
  }

  stopComparison() {
    if (!this.comparisonActive) return
    this.clearComparisonMeshes()
    if (this.comparisonRecord) this.comparisonRecord.mesh.visible = this.comparisonOriginalVisible
    for (const mesh of this.comparisonHiddenMeshes) mesh.visible = true
    this.comparisonHiddenMeshes = []
    this.comparisonActive = false
    this.comparisonRecord = null
    this.legend.hidden = true
    this.compareButton.setAttribute('aria-pressed', 'false')
    this.compareButton.textContent = 'Compare techniques'
    this.objectEditor.transformHelper.visible = Boolean(this.objectEditor.selected && this.objectEditor.active)
    if (this.objectEditor.selectionOutline) this.objectEditor.selectionOutline.visible = true
    this.markShadowsDirty()
  }

  setActive(active) {
    this.panel.hidden = !active
    if (!active && this.comparisonActive) this.stopComparison()
  }

  dispose() {
    if (this.comparisonActive) this.stopComparison()
    document.removeEventListener('shadowlab:object-selection-changed', this.onSelectionChanged)
    document.removeEventListener('shadowlab:object-removed', this.onObjectRemoved)
    for (const material of this.appliedMaterials.values()) disposeMaterial(material)
    this.appliedMaterials.clear()
  }
}