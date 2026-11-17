export const gouraudVertexShader = `
const int MAX_LIGHTS = 8;

uniform int uLightCount;
uniform vec3 uLightPositions[MAX_LIGHTS];
uniform vec3 uLightDirections[MAX_LIGHTS];
uniform vec3 uLightColors[MAX_LIGHTS];
uniform float uLightIntensities[MAX_LIGHTS];
uniform float uLightRanges[MAX_LIGHTS];
uniform float uLightInnerCosines[MAX_LIGHTS];
uniform float uLightOuterCosines[MAX_LIGHTS];
uniform int uLightTypes[MAX_LIGHTS];
uniform vec3 uMaterialColor;
uniform float uAmbientComponent;
uniform float uDiffuseComponent;
uniform float uSpecularComponent;
uniform float uShininess;
uniform float uRoughness;
uniform float uMetalness;

varying vec3 vGouraudColor;

vec3 safeNormalize(vec3 value, vec3 fallbackValue) {
  float magnitudeSquared = dot(value, value);
  return magnitudeSquared > 0.000001 ? value * inversesqrt(magnitudeSquared) : fallbackValue;
}

vec3 calculateGouraudLighting(vec3 viewPosition, vec3 normalView) {
  vec3 normal = safeNormalize(normalView, vec3(0.0, 0.0, 1.0));
  vec3 viewDirection = safeNormalize(-viewPosition, vec3(0.0, 0.0, 1.0));
  vec3 baseColor = uMaterialColor;
  vec3 f0 = mix(vec3(0.04), baseColor, uMetalness);
  vec3 result = baseColor * uAmbientComponent * 0.65;
  float exponent = max(1.0, uShininess * (1.0 - 0.78 * uRoughness));

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;

    vec3 lightPositionView = (viewMatrix * vec4(uLightPositions[i], 1.0)).xyz;
    vec3 lightDirectionView = safeNormalize((viewMatrix * vec4(uLightDirections[i], 0.0)).xyz, vec3(0.0, -1.0, 0.0));
    vec3 toLight = lightPositionView - viewPosition;
    float distanceToLight = length(toLight);
    vec3 lightDirection = uLightTypes[i] == 1
      ? safeNormalize(-lightDirectionView, vec3(0.0, 1.0, 0.0))
      : safeNormalize(toLight, vec3(0.0, 1.0, 0.0));
    float attenuation = uLightTypes[i] == 1 ? 1.0 : 1.0 / (1.0 + 0.045 * distanceToLight + 0.012 * distanceToLight * distanceToLight);

    if (uLightRanges[i] > 0.0 && uLightTypes[i] != 1) {
      float rangeRatio = distanceToLight / uLightRanges[i];
      attenuation *= clamp(1.0 - rangeRatio * rangeRatio, 0.0, 1.0);
    }

    float spotEffect = 1.0;
    if (uLightTypes[i] == 2) {
      float coneCosine = dot(safeNormalize(viewPosition - lightPositionView, -lightDirectionView), lightDirectionView);
      spotEffect = smoothstep(uLightOuterCosines[i], uLightInnerCosines[i], coneCosine);
    }

    float diffuse = max(dot(normal, lightDirection), 0.0);
    vec3 reflectedLight = reflect(-lightDirection, normal);
    float specular = diffuse > 0.0 ? pow(max(dot(reflectedLight, viewDirection), 0.0), exponent) : 0.0;
    float energyScale = uLightTypes[i] == 1 ? 0.55 : 0.045;
    vec3 diffuseTerm = baseColor * diffuse * uDiffuseComponent * (1.0 - uMetalness);
    vec3 specularTerm = f0 * specular * uSpecularComponent;
    result += (diffuseTerm + specularTerm) * uLightColors[i] * uLightIntensities[i] * energyScale * attenuation * spotEffect;
  }

  return result;
}

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vec3 viewNormal = normalize(normalMatrix * normal);
  vGouraudColor = calculateGouraudLighting(viewPosition.xyz, viewNormal);
  gl_Position = projectionMatrix * viewPosition;
}
`

export const gouraudFragmentShader = `
uniform float uOpacity;
varying vec3 vGouraudColor;

void main() {
  gl_FragColor = vec4(max(vGouraudColor, vec3(0.0)), uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`