import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { computed, reactive, ref } from 'vue'
import ts from 'typescript'
import { cropFrame, cropPixels, defaultAdjustments, imageGeometry } from '../app/utils/media-image-processing'

const editor = readFileSync(new URL('../app/components/ProductsMediaImageEditor.vue', import.meta.url), 'utf8')
const cropper = readFileSync(new URL('../app/components/ProductsMediaCropper.vue', import.meta.url), 'utf8')
const script = cropper.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1]!
const parsed = ts.createSourceFile('cropper.ts', script, ts.ScriptTarget.Latest, true)
const declarations = [
  'dimensions',
  'settings',
  'geometry',
  'ratios',
  'crop',
  'cropRatio',
  'zoom',
  'horizontal',
  'vertical',
  'adjustable',
  'selectingCrop',
  'previewStyle'
]
const source = ts.transpileModule(
  parsed.statements
    .filter(
      (statement) =>
        (ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.some(
            (declaration) => ts.isIdentifier(declaration.name) && declarations.includes(declaration.name.text)
          )) ||
        (ts.isFunctionDeclaration(statement) && statement.name?.text === 'change')
    )
    .map((statement) => statement.getText(parsed))
    .join('\n') + '\nexport { dimensions, zoom, selectingCrop, previewStyle, change }',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

function harness(width: number, height: number) {
  const appliedCrop = cropFrame(width, height, 1, 100, 50, 50)
  const props = reactive({
    editing: false,
    cropSelectionRequired: false,
    canCrop: true,
    disabled: false,
    selection: { ...appliedCrop },
    appliedCrop,
    adjustments: defaultAdjustments()
  })
  const exports = {} as {
    dimensions: { value: { width: number; height: number } }
    zoom: { value: number }
    selectingCrop: { value: boolean }
    previewStyle: { value: { aspectRatio: number } }
    change(zoom?: number, horizontal?: number, vertical?: number): void
  }
  runInNewContext(source, {
    exports,
    props,
    computed,
    ref,
    cropFrame,
    cropPixels,
    defaultAdjustments,
    imageGeometry,
    mt: (value: string) => value,
    emit: (event: string, value: typeof appliedCrop) => {
      if (event === 'update:crop') {
        props.selection = value
      }
    }
  })
  exports.dimensions.value = { width, height }
  return { ...exports, props }
}

test('image editor requests the crop overlay whenever adjustment mode is active', () => {
  assert.match(editor, /:crop-selection-required="editing"/)
})

test('entering adjustment mode shows the full editing source without changing the crop or zoom', () => {
  const fixture = harness(1200, 800)
  assert.equal(fixture.selectingCrop.value, false)
  assert.equal(fixture.previewStyle.value.aspectRatio, 1)
  fixture.props.editing = true
  fixture.props.cropSelectionRequired = true
  assert.equal(fixture.selectingCrop.value, true)
  assert.equal(fixture.previewStyle.value.aspectRatio, 1.5)
  assert.equal(fixture.zoom.value, 100)
  assert.deepEqual(fixture.props.selection, fixture.props.appliedCrop)
  fixture.props.editing = false
  fixture.props.cropSelectionRequired = false
  assert.equal(fixture.selectingCrop.value, false)
  assert.equal(fixture.previewStyle.value.aspectRatio, 1)
})

test('minimum-zoom crops can move horizontally or vertically without altering the applied crop', () => {
  for (const [width, height, horizontal, vertical] of [
    [1200, 800, 0, 50],
    [800, 1200, 50, 0]
  ]) {
    const fixture = harness(width!, height!)
    fixture.props.editing = true
    fixture.props.cropSelectionRequired = true
    fixture.change(undefined, horizontal, vertical)
    assert.equal(fixture.zoom.value, 100)
    assert.equal(fixture.selectingCrop.value, true)
    assert.notDeepEqual(fixture.props.selection, fixture.props.appliedCrop)
    assert.equal(fixture.props.selection.width, fixture.props.appliedCrop.width)
    assert.equal(fixture.props.selection.height, fixture.props.appliedCrop.height)
    assert.equal(horizontal === 0 ? fixture.props.selection.x : fixture.props.selection.y, 0)
  }
})

test('non-croppable images never show the crop overlay', () => {
  const fixture = harness(1200, 800)
  fixture.props.editing = true
  fixture.props.cropSelectionRequired = true
  fixture.props.canCrop = false
  assert.equal(fixture.selectingCrop.value, false)
})
