import '../styles/main.css'
import { createInitialScene } from './core/scene.js'
import { LightManager } from './lights/lightManager.js'
import { MaterialLab } from './materials/materialLab.js'
import { ShadowManager } from './shadows/shadowManager.js'
import { ObjectEditor } from './ui/objectEditor.js'

const app = document.querySelector('#app')

app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" aria-label="ShadowLab home">
      <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="brand-name">SHADOW<span>LAB</span></span>
      <span class="brand-edition">CG LAB / 01</span>
    </a>
    <nav class="module-nav" aria-label="Project modules">
      <button class="module-tab is-active" type="button" data-workspace="objects" aria-current="page">Scene Editor</button>
      <button class="module-tab" type="button" data-workspace="lighting">Lighting Studio</button>
      <button class="module-tab" type="button" data-workspace="shadows">Shadow Studio</button>
      <button class="module-tab" type="button" data-workspace="materials">Material Lab</button>
      <button class="module-tab" type="button" disabled>Experiments</button>
    </nav>
    <div class="project-state"><span class="state-dot"></span> SCENE READY</div>
  </header>

  <main class="workspace">
    <aside class="panel object-panel" aria-labelledby="sidebar-heading">
      <div class="panel-heading">
        <div>
          <p class="eyebrow" id="sidebar-eyebrow">SCENE GRAPH</p>
          <h1 id="sidebar-heading">Objects</h1>
        </div>
        <span class="count-badge" id="sidebar-count">00</span>
      </div>
      <div id="object-mode-panel">
        <div class="panel-rule"></div>
        <div class="primitive-tools" id="primitive-tools" aria-label="Add a primitive">
          <button type="button" data-add-object="cube">+ Cube</button>
          <button type="button" data-add-object="sphere">+ Sphere</button>
          <button type="button" data-add-object="cone">+ Cone</button>
          <button type="button" data-add-object="cylinder">+ Cylinder</button>
          <button type="button" data-add-object="pyramid">+ Pyramid</button>
        </div>
        <div class="object-list" id="object-list" aria-label="Scene objects"></div>
        <div class="panel-footer"><span>SCENE CONTENTS</span><span id="object-count">00 ITEMS</span></div>
      </div>
      <div id="lighting-mode-panel" hidden>
        <div class="panel-rule"></div>
        <div class="primitive-tools light-tools" id="light-tools" aria-label="Add a light source">
          <button type="button" data-add-light="point">+ Point</button>
          <button type="button" data-add-light="directional">+ Directional</button>
          <button type="button" data-add-light="spot">+ Spot</button>
        </div>
        <div class="object-list" id="light-list" aria-label="Scene light sources"></div>
        <div class="panel-footer"><span>LIGHT RIG</span><span id="list-count">00 LIGHTS</span></div>
      </div>
      <div id="shadow-mode-panel" hidden>
        <div class="panel-rule"></div>
        <section class="shadow-controls" aria-label="Global shadow settings">
          <button class="shadow-toggle" id="shadows-enabled" type="button" role="switch" aria-checked="true">
            <span>Real-time shadows</span>
            <span class="shadow-state" id="shadow-state">ON</span>
            <span class="toggle-track" aria-hidden="true"></span>
          </button>
          <label class="shadow-quality" for="shadow-quality">
            <span>Shadow quality</span>
            <select id="shadow-quality">
              <option value="512">Low / 512 px</option>
              <option value="1024" selected>Medium / 1024 px</option>
              <option value="2048">High / 2048 px</option>
            </select>
          </label>
          <label class="shadow-softness" for="shadow-softness">
            <span>Softness <output id="shadow-softness-value">2.5</output></span>
            <input id="shadow-softness" type="range" min="0" max="6" step="0.5" value="2.5" />
            <small>PCF filter radius</small>
          </label>
        </section>
        <div class="panel-footer"><span>SHADOW MAP</span><span id="shadow-list-count">01 CASTERS</span></div>
      </div>
    </aside>

    <section class="viewport-panel" aria-labelledby="viewport-heading">
      <div class="viewport-toolbar">
        <div>
          <p class="eyebrow">WORKSPACE / SCENE 01</p>
          <h2 id="viewport-heading">Viewport</h2>
        </div>
        <span class="renderer-badge" id="renderer-badge"><span class="state-dot"></span> STARTING WEBGL</span>
      </div>
      <div class="viewport-stage" id="scene-viewport" role="img" aria-label="Three-dimensional scene with five geometric primitives on a ground grid"></div>
      <div class="material-comparison-legend" id="material-comparison-legend" hidden>
        <span>FLAT</span><span>SMOOTH</span><span>GOURAUD</span><span>PHONG</span>
      </div>
      <div class="viewport-status">
        <span><i class="status-square"></i> Perspective</span>
        <span>GRID <b>16 × 16</b></span>
        <span><span id="scene-status-label">SCENE</span> <b id="scene-status-count">5 OBJECTS</b></span>
        <span class="status-spacer"></span>
        <span>WEBGL <b>ACTIVE</b></span>
      </div>
    </section>

    <aside class="panel inspector-panel" aria-labelledby="inspector-heading">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">SELECTION</p>
          <h2 id="inspector-heading">Inspector</h2>
        </div>
        <div class="inspector-actions" id="object-inspector-actions">
          <button id="duplicate-object" type="button" disabled>Duplicate</button>
          <button id="delete-object" type="button" disabled>Delete</button>
        </div>
        <div class="inspector-actions" id="light-inspector-actions" hidden>
          <button id="remove-light" type="button" disabled>Remove</button>
        </div>
        <div class="inspector-actions" id="material-inspector-actions" hidden>
          <button id="material-reset" type="button" disabled>Reset material</button>
        </div>
      </div>
      <div class="panel-rule"></div>
      <div id="object-inspector-panel">
        <div class="inspector-empty" id="inspector-empty">
          <span class="selection-mark" aria-hidden="true"></span>
          <p>Nothing selected</p>
          <span>Select an object from the scene or list.</span>
        </div>
        <div class="object-properties" id="object-properties" hidden>
          <div class="selected-object-heading">
            <span class="selected-object-symbol" aria-hidden="true">◈</span>
            <span id="selected-object-name">Object</span>
            <span class="object-type" id="selected-object-type">BOX</span>
          </div>
          <label class="color-control" for="material-color">
            <span>Object colour</span>
            <input id="material-color" type="color" value="#d8b36a" />
          </label>
          <section class="property-group" aria-labelledby="transform-heading">
            <div class="property-title"><span id="transform-heading">TRANSFORM</span><span>WORLD SPACE</span></div>
            <div class="transform-modes" role="group" aria-label="Transform mode">
              <button type="button" data-transform-mode="translate" aria-pressed="true">Move</button>
              <button type="button" data-transform-mode="rotate" aria-pressed="false">Rotate</button>
              <button type="button" data-transform-mode="scale" aria-pressed="false">Scale</button>
            </div>
            <div class="transform-fields">
              <div class="transform-row">
                <span class="transform-label">Position</span>
                <label class="axis-field axis-x"><span>X</span><input type="number" step="0.1" data-transform="position" data-axis="x" aria-label="Position X" /></label>
                <label class="axis-field axis-y"><span>Y</span><input type="number" step="0.1" data-transform="position" data-axis="y" aria-label="Position Y" /></label>
                <label class="axis-field axis-z"><span>Z</span><input type="number" step="0.1" data-transform="position" data-axis="z" aria-label="Position Z" /></label>
              </div>
              <div class="transform-row">
                <span class="transform-label">Rotation <small>deg</small></span>
                <label class="axis-field axis-x"><span>X</span><input type="number" step="1" data-transform="rotation" data-axis="x" aria-label="Rotation X in degrees" /></label>
                <label class="axis-field axis-y"><span>Y</span><input type="number" step="1" data-transform="rotation" data-axis="y" aria-label="Rotation Y in degrees" /></label>
                <label class="axis-field axis-z"><span>Z</span><input type="number" step="1" data-transform="rotation" data-axis="z" aria-label="Rotation Z in degrees" /></label>
              </div>
              <div class="transform-row">
                <span class="transform-label">Scale</span>
                <label class="axis-field axis-x"><span>X</span><input type="number" min="0.01" step="0.1" data-transform="scale" data-axis="x" aria-label="Scale X" /></label>
                <label class="axis-field axis-y"><span>Y</span><input type="number" min="0.01" step="0.1" data-transform="scale" data-axis="y" aria-label="Scale Y" /></label>
                <label class="axis-field axis-z"><span>Z</span><input type="number" min="0.01" step="0.1" data-transform="scale" data-axis="z" aria-label="Scale Z" /></label>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div id="light-inspector-panel" hidden>
        <div class="inspector-empty" id="light-inspector-empty">
          <span class="selection-mark" aria-hidden="true"></span>
          <p>No light selected</p>
          <span>Select a source to adjust its properties.</span>
        </div>
        <div class="object-properties light-properties" id="light-properties" hidden>
          <div class="selected-object-heading">
            <span class="selected-object-symbol light-symbol" aria-hidden="true">●</span>
            <span id="selected-light-name">Light</span>
            <span class="object-type" id="selected-light-type">POINT</span>
          </div>
          <label class="color-control" for="light-color">
            <span>Light colour</span>
            <input id="light-color" type="color" value="#ffc978" />
          </label>
          <label class="light-intensity" for="light-intensity">
            <span>Intensity <small>relative energy</small></span>
            <input id="light-intensity" type="number" min="0" max="100" step="0.1" data-light-property="intensity" aria-label="Light intensity" />
          </label>
          <label class="light-toggle" for="light-enabled">
            <span>Light enabled</span>
            <input id="light-enabled" type="checkbox" checked />
            <span class="toggle-track" aria-hidden="true"></span>
          </label>
          <section class="property-group" aria-labelledby="light-position-heading">
            <div class="property-title"><span id="light-position-heading">POSITION</span><span>WORLD SPACE</span></div>
            <div class="transform-fields light-position-fields">
              <div class="transform-row">
                <span class="transform-label">Position</span>
                <label class="axis-field axis-x"><span>X</span><input type="number" step="0.1" data-light-property="position" data-axis="x" aria-label="Light position X" /></label>
                <label class="axis-field axis-y"><span>Y</span><input type="number" step="0.1" data-light-property="position" data-axis="y" aria-label="Light position Y" /></label>
                <label class="axis-field axis-z"><span>Z</span><input type="number" step="0.1" data-light-property="position" data-axis="z" aria-label="Light position Z" /></label>
              </div>
            </div>
          </section>
          <p class="light-help">Direction lights point toward the scene origin. Markers show each source position.</p>
        </div>
      </div>
      <div id="shadow-inspector-panel" hidden>
        <div class="shadow-source-heading">
          <span class="property-title">CAST SHADOWS</span>
          <span class="object-type">PER LIGHT</span>
        </div>
        <div id="shadow-light-list" class="shadow-source-list" aria-label="Choose lights that cast shadows"></div>
        <p class="shadow-note">Point lights use cube shadow maps; directional and spot lights use perspective/orthographic depth maps.</p>
      </div>
      <div id="material-inspector-panel" hidden>
        <div class="inspector-empty" id="material-inspector-empty">
          <span class="selection-mark" aria-hidden="true"></span>
          <p>No object selected</p>
          <span>Select a scene object to edit its shading and material.</span>
        </div>
        <div class="material-properties" id="material-properties" hidden>
          <div class="selected-object-heading">
            <span class="selected-object-symbol material-symbol" aria-hidden="true">◒</span>
            <span id="material-target-name">Object</span>
            <span class="object-type" id="material-target-type">BOX</span>
          </div>
          <section class="material-group" aria-labelledby="shading-heading">
            <div class="property-title"><span id="shading-heading">SHADING TECHNIQUE</span><span>ILLUMINATION</span></div>
            <div class="material-techniques" role="group" aria-label="Shading technique">
              <button type="button" data-shading-technique="flat" aria-pressed="false">Flat</button>
              <button type="button" data-shading-technique="smooth" aria-pressed="true">Smooth</button>
              <button type="button" data-shading-technique="gouraud" aria-pressed="false">Gouraud</button>
              <button type="button" data-shading-technique="phong" aria-pressed="false">Phong</button>
            </div>
          </section>
          <label class="material-type-control" for="material-type">
            <span>Material</span>
            <select id="material-type">
              <option value="plastic">Plastic</option>
              <option value="metallic">Metallic</option>
              <option value="glass">Glass-like</option>
              <option value="matte">Matte</option>
            </select>
          </label>
          <label class="color-control" for="lab-material-color">
            <span>Material colour</span>
            <input id="lab-material-color" type="color" value="#d8b36a" />
          </label>
          <section class="material-group" aria-labelledby="illumination-heading">
            <div class="property-title"><span id="illumination-heading">ILLUMINATION MODEL</span><span>PHONG TERMS</span></div>
            <div class="material-component">
              <label for="material-ambient">Ambient <output id="material-ambient-value">0.35</output></label>
              <input id="material-ambient" type="range" min="0" max="1.5" step="0.05" value="0.35" data-material-component="ambient" />
            </div>
            <div class="material-component">
              <label for="material-diffuse">Diffuse <output id="material-diffuse-value">1</output></label>
              <input id="material-diffuse" type="range" min="0" max="1.5" step="0.05" value="1" data-material-component="diffuse" />
            </div>
            <div class="material-component">
              <label for="material-specular">Specular <output id="material-specular-value">0.65</output></label>
              <input id="material-specular" type="range" min="0" max="1.5" step="0.05" value="0.65" data-material-component="specular" />
            </div>
            <div class="material-component shininess-control">
              <label for="material-shininess">Shininess <output id="material-shininess-value">48</output></label>
              <input id="material-shininess" type="range" min="1" max="128" step="1" value="48" data-material-component="shininess" />
            </div>
          </section>
          <button class="comparison-button" id="material-compare" type="button" aria-pressed="false" disabled>Compare techniques</button>
          <p class="material-note">Gouraud interpolates vertex lighting; Phong evaluates lighting per fragment. Glass-like mode is tinted transparency, not environment-refraction.</p>
        </div>
      </div>
    </aside>
  </main>

  <footer class="bottom-bar">
    <div class="transform-readout"><span class="eyebrow">TRANSFORM</span><span class="disabled-label">No active selection</span></div>
    <div class="bottom-divider"></div>
    <div class="scene-readout"><span class="eyebrow">SCENE</span><span>Unsaved setup</span></div>
    <span class="bottom-spacer"></span>
    <span class="version-label">SHADOWLAB <b>0.1.0</b></span>
  </footer>
`

const viewport = document.querySelector('#scene-viewport')
const rendererBadge = document.querySelector('#renderer-badge')

try {
  const sceneBundle = createInitialScene(viewport)
  const objectEditor = new ObjectEditor({ ...sceneBundle, initialObjects: sceneBundle.objects })
  const lightManager = new LightManager({ ...sceneBundle, initialLights: sceneBundle.initialLights })
  const shadowManager = new ShadowManager({ ...sceneBundle, lightManager })
  const materialLab = new MaterialLab({ ...sceneBundle, objectEditor, lightManager })
  const objectModePanel = document.querySelector('#object-mode-panel')
  const lightingModePanel = document.querySelector('#lighting-mode-panel')
  const shadowModePanel = document.querySelector('#shadow-mode-panel')
  const materialInspectorPanel = document.querySelector('#material-inspector-panel')
  const objectInspectorPanel = document.querySelector('#object-inspector-panel')
  const lightInspectorPanel = document.querySelector('#light-inspector-panel')
  const shadowInspectorPanel = document.querySelector('#shadow-inspector-panel')
  const objectInspectorActions = document.querySelector('#object-inspector-actions')
  const lightInspectorActions = document.querySelector('#light-inspector-actions')
  const materialInspectorActions = document.querySelector('#material-inspector-actions')

  document.querySelectorAll('[data-workspace]').forEach((button) => {
    button.addEventListener('click', () => {
      const isObjects = button.dataset.workspace === 'objects'
      const isLighting = button.dataset.workspace === 'lighting'
      const isShadows = button.dataset.workspace === 'shadows'
      const isMaterials = button.dataset.workspace === 'materials'
      document.querySelectorAll('[data-workspace]').forEach((tab) => {
        const selected = tab === button
        tab.classList.toggle('is-active', selected)
        if (selected) tab.setAttribute('aria-current', 'page')
        else tab.removeAttribute('aria-current')
      })
      document.querySelector('#sidebar-eyebrow').textContent = isLighting ? 'LIGHT RIG' : isShadows ? 'SHADOW LAB' : isMaterials ? 'MATERIAL TARGETS' : 'SCENE GRAPH'
      document.querySelector('#sidebar-heading').textContent = isLighting ? 'Lights' : isShadows ? 'Shadows' : 'Objects'
      document.querySelector('#inspector-heading').textContent = isLighting ? 'Light Properties' : isShadows ? 'Shadow Sources' : isMaterials ? 'Material Lab' : 'Inspector'
      document.querySelector('.project-state').lastChild.textContent = isLighting ? ' LIGHTING STUDIO' : isShadows ? ' SHADOW STUDIO' : isMaterials ? ' MATERIAL LAB' : ' SCENE READY'
      objectModePanel.hidden = !(isObjects || isMaterials)
      objectModePanel.classList.toggle('material-target-mode', isMaterials)
      lightingModePanel.hidden = !isLighting
      shadowModePanel.hidden = !isShadows
      objectInspectorPanel.hidden = !isObjects
      lightInspectorPanel.hidden = !isLighting
      shadowInspectorPanel.hidden = !isShadows
      materialInspectorPanel.hidden = !isMaterials
      objectInspectorActions.hidden = !isObjects
      lightInspectorActions.hidden = !isLighting
      materialInspectorActions.hidden = !isMaterials
      objectEditor.select(null)
      objectEditor.setActive(isObjects || isMaterials)
      lightManager.select(null)
      lightManager.setActive(isLighting)
      shadowManager.setActive(isShadows)
      materialLab.setActive(isMaterials)
      sceneBundle.setCameraTargetHeight(isLighting ? 2.35 : 0.65)
      const activeCount = isLighting
        ? lightManager.records.length
        : isShadows
          ? lightManager.records.filter((record) => record.castShadow && record.enabled).length
          : objectEditor.objectManager.records.length
      document.querySelector('#sidebar-count').textContent = String(activeCount).padStart(2, '0')
      document.querySelector('#scene-status-label').textContent = isLighting ? 'LIGHTS' : isShadows ? 'SHADOWS' : isMaterials ? 'MATERIALS' : 'SCENE'
      document.querySelector('#scene-status-count').textContent = isLighting
        ? `${activeCount} SOURCES`
        : isShadows
          ? shadowManager.enabled ? `${activeCount} CASTERS` : 'OFF'
          : isMaterials
            ? `${activeCount} TARGETS`
          : `${activeCount} OBJECTS`
    })
  })
  document.querySelector('[data-workspace="objects"]').click()
  rendererBadge.innerHTML = '<span class="state-dot"></span> WEBGL RENDERER ACTIVE'
} catch (error) {
  console.error('Unable to initialize the ShadowLab scene:', error)
  viewport.innerHTML = '<p class="scene-error">WebGL could not start. Check that browser hardware acceleration is enabled.</p>'
  rendererBadge.innerHTML = '<span class="state-dot is-error"></span> WEBGL UNAVAILABLE'
  document.querySelector('.viewport-status').lastElementChild.innerHTML = 'WEBGL <b>UNAVAILABLE</b>'
}