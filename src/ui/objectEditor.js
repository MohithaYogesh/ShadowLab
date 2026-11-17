import * as THREE from 'three'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { ObjectManager } from '../objects/objectManager.js'

export class ObjectEditor {
  constructor({ scene, camera, renderer, initialObjects, markShadowsDirty = () => {} }) {
    this.scene = scene
    this.camera = camera
    this.renderer = renderer
    this.markShadowsDirty = markShadowsDirty
    this.active = true
    this.objectManager = new ObjectManager(scene, initialObjects)
    this.selected = null
    this.selectionOutline = null
    this.pointerStart = null
    this.gizmoGesture = false
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()

    this.objectList = document.querySelector('#object-list')
    this.primitiveTools = document.querySelector('#primitive-tools')
    this.inspectorEmpty = document.querySelector('#inspector-empty')
    this.properties = document.querySelector('#object-properties')
    this.duplicateButton = document.querySelector('#duplicate-object')
    this.deleteButton = document.querySelector('#delete-object')

    this.transformControls = new TransformControls(camera, renderer.domElement)
    this.transformHelper = this.transformControls.getHelper()
    this.transformHelper.visible = false
    scene.add(this.transformHelper)
    this.bindEvents()
    this.renderList()
  }

  bindEvents() {
    this.objectList.addEventListener('click', (event) => {
      const row = event.target.closest('[data-object-id]')
      if (row) this.select(row.dataset.objectId)
    })

    this.primitiveTools.addEventListener('click', (event) => {
      const button = event.target.closest('[data-add-object]')
      if (!button) return
      const record = this.objectManager.add(button.dataset.addObject)
      if (record) {
        this.markShadowsDirty()
        this.renderList()
        this.select(record.id)
      }
    })

    this.duplicateButton.addEventListener('click', () => {
      if (!this.selected) return
      const duplicate = this.objectManager.duplicate(this.selected.id)
      if (duplicate) {
        this.markShadowsDirty()
        this.renderList()
        this.select(duplicate.id)
      }
    })

    this.deleteButton.addEventListener('click', () => {
      if (!this.selected) return
      const id = this.selected.id
      this.select(null)
      const removed = this.objectManager.remove(id)
      document.dispatchEvent(new CustomEvent('shadowlab:object-removed', { detail: { record: removed } }))
      this.markShadowsDirty()
      this.renderList()
    })

    document.querySelectorAll('[data-transform-mode]').forEach((button) => {
      button.addEventListener('click', () => this.setMode(button.dataset.transformMode))
    })

    this.properties.addEventListener('input', (event) => this.onPropertyInput(event))
    this.properties.addEventListener('change', (event) => {
      if (event.target.matches('[data-transform]')) this.syncProperties()
    })

    const canvas = this.renderer.domElement
    this.onPointerDown = (event) => {
      this.pointerStart = { x: event.clientX, y: event.clientY }
    }
    this.onPointerUp = (event) => {
      if (!this.active) return
      const start = this.pointerStart
      this.pointerStart = null
      if (!start || this.gizmoGesture || this.transformControls.dragging) return
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return
      this.selectFromViewport(event)
    }
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)

    this.transformControls.addEventListener('mouseDown', () => {
      this.gizmoGesture = true
    })
    this.transformControls.addEventListener('mouseUp', () => {
      setTimeout(() => { this.gizmoGesture = false }, 0)
    })
    this.transformControls.addEventListener('objectChange', () => {
      this.selectionOutline?.update()
      this.markShadowsDirty()
      this.syncProperties()
    })
  }

  renderList() {
    this.objectList.replaceChildren()

    for (const record of this.objectManager.records) {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'object-item'
      row.dataset.objectId = record.id
      row.setAttribute('aria-pressed', String(record.id === this.selected?.id))

      const swatch = document.createElement('span')
      swatch.className = 'object-swatch'
      swatch.style.setProperty('--swatch-color', record.color)
      swatch.setAttribute('aria-hidden', 'true')

      const name = document.createElement('span')
      name.className = 'object-name'
      name.textContent = record.name

      const type = document.createElement('span')
      type.className = 'object-type'
      type.textContent = record.type

      row.append(swatch, name, type)
      this.objectList.append(row)
    }

    const count = String(this.objectManager.records.length).padStart(2, '0')
    document.querySelector('.count-badge').textContent = count
    document.querySelector('#sidebar-count').textContent = count
    document.querySelector('#object-count').textContent = `${count} ITEMS`
    document.querySelector('.viewport-status span:nth-child(3) b').textContent = `${this.objectManager.records.length} OBJECTS`
    document.querySelector('#scene-status-label').textContent = 'SCENE'
    this.objectList.setAttribute('aria-label', 'Scene objects')
    this.renderer.domElement.setAttribute('aria-label', `Rendered 3D scene with ${this.objectManager.records.length} objects`)
    document.querySelector('#scene-viewport').setAttribute('aria-label', `Three-dimensional scene with ${this.objectManager.records.length} objects on a ground grid`)
  }

  select(id) {
    this.clearSelectionOutline()
    this.selected = id ? this.objectManager.get(id) : null

    if (this.selected) {
      this.transformControls.attach(this.selected.mesh)
      this.selectionOutline = new THREE.BoxHelper(this.selected.mesh, '#c0dc6b')
      this.selectionOutline.material.depthTest = false
      this.selectionOutline.renderOrder = 20
      this.scene.add(this.selectionOutline)
    } else {
      this.transformControls.detach()
    }

    this.inspectorEmpty.hidden = Boolean(this.selected)
    this.properties.hidden = !this.selected
    this.duplicateButton.disabled = !this.selected
    this.deleteButton.disabled = !this.selected
    document.querySelector('.disabled-label').textContent = this.selected ? `Selected: ${this.selected.name}` : 'No active selection'
    this.renderList()
    this.syncProperties()
    document.dispatchEvent(new CustomEvent('shadowlab:object-selection-changed', { detail: { record: this.selected } }))
  }

  selectFromViewport(event) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const meshes = this.objectManager.records.map((record) => record.mesh)
    const hit = this.raycaster.intersectObjects(meshes, false)[0]
    this.select(hit?.object.userData.shadowLabId ?? null)
  }

  clearSelectionOutline() {
    if (!this.selectionOutline) return
    this.scene.remove(this.selectionOutline)
    this.selectionOutline.geometry.dispose()
    this.selectionOutline.material.dispose()
    this.selectionOutline = null
  }

  setMode(mode) {
    this.transformControls.setMode(mode)
    document.querySelectorAll('[data-transform-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.transformMode === mode))
    })
  }

  setActive(active) {
    this.active = active
  }

  onPropertyInput(event) {
    if (!this.selected) return
    const input = event.target

    if (input.matches('[data-transform]')) {
      if (input.value.trim() === '') return
      const value = Number(input.value)
      if (!Number.isFinite(value)) return

      const { transform, axis } = input.dataset
      if (transform === 'rotation') {
        this.selected.mesh.rotation[axis] = THREE.MathUtils.degToRad(value)
      } else if (transform === 'scale') {
        this.selected.mesh.scale[axis] = Math.max(0.01, value)
      } else {
        this.selected.mesh.position[axis] = value
      }

      this.selectionOutline?.update()
      this.markShadowsDirty()
      this.syncProperties(input)
      return
    }

    if (input.matches('#material-color')) {
      if (this.objectManager.setColor(this.selected.id, input.value)) {
        const row = this.objectList.querySelector(`[data-object-id="${this.selected.id}"] .object-swatch`)
        row?.style.setProperty('--swatch-color', input.value)
      }
    }
  }

  syncProperties(activeInput = null) {
    if (!this.selected) return

    document.querySelector('#selected-object-name').textContent = this.selected.name
    document.querySelector('#selected-object-type').textContent = this.selected.type
    document.querySelector('#material-color').value = this.selected.color

    this.properties.querySelectorAll('[data-transform]').forEach((input) => {
      if (input === activeInput) return
      const { transform, axis } = input.dataset
      const value = transform === 'rotation'
        ? THREE.MathUtils.radToDeg(this.selected.mesh.rotation[axis])
        : this.selected.mesh[transform][axis]
      input.value = Number(value.toFixed(3)).toString()
    })
  }

  dispose() {
    this.clearSelectionOutline()
    this.transformControls.dispose()
    this.scene.remove(this.transformHelper)
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown)
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp)
  }
}