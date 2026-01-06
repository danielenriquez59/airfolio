<script setup lang="ts">
import type { SparInputs } from '~/types/spar.types'
import SchrenkInputGroup from '~/layers/landing/components/schrenk/SchrenkInputGroup.vue'

interface Props {
  modelValue: SparInputs
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: SparInputs]
}>()

const updateValue = (key: keyof SparInputs, value: number | string) => {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

// Computed unit labels and steps
const lengthUnit = computed(() => props.modelValue.unitSystem)
const lengthStep = computed(() => {
  switch (props.modelValue.unitSystem) {
    case 'mm': return 1
    case 'in': return 0.1
    case 'm': return 0.01
    case 'ft': return 0.1
    default: return 1
  }
})
const thicknessStep = computed(() => {
  switch (props.modelValue.unitSystem) {
    case 'mm': return 0.001
    case 'in': return 0.0001
    case 'm': return 0.00001
    case 'ft': return 0.0001
    default: return 0.001
  }
})
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
    <div class="flex items-center gap-2 mb-4 text-slate-900 font-semibold border-b border-slate-100 pb-2">
      <Icon name="heroicons:calculator" class="h-5 w-5 text-blue-600" />
      <h2>Parameters</h2>
    </div>

    <div class="space-y-1">
      <!-- Airfoil Parameters Section -->
      <div class="mb-4 pb-4 border-b border-slate-100">
        <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Airfoil Parameters
        </h3>

        <!-- Unit System Dropdown -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            Unit System
            <span class="text-slate-400 cursor-help" title="Choose length units for all measurements">ⓘ</span>
          </label>
          <select
            :value="modelValue.unitSystem"
            @input="updateValue('unitSystem', ($event.target as HTMLSelectElement).value)"
            class="block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          >
            <option value="mm">Millimeters (mm)</option>
            <option value="in">Inches (in)</option>
            <option value="m">Meters (m)</option>
            <option value="ft">Feet (ft)</option>
          </select>
        </div>

        <SchrenkInputGroup
          label="Chord Length"
          name="chordLength"
          :model-value="modelValue.chordLength"
          @update:model-value="updateValue('chordLength', $event)"
          :unit="lengthUnit"
          :step="lengthStep"
          tooltip="Total chord length of the airfoil"
        />
        <SchrenkInputGroup
          label="Skin Thickness"
          name="skinThickness"
          :model-value="modelValue.skinThickness"
          @update:model-value="updateValue('skinThickness', $event)"
          :unit="lengthUnit"
          :step="thicknessStep"
          tooltip="Thickness of the airfoil skin material"
        />
        <SchrenkInputGroup
          label="Skin Offset"
          name="skinOffset"
          :model-value="modelValue.skinOffset"
          @update:model-value="updateValue('skinOffset', $event)"
          :unit="lengthUnit"
          :step="thicknessStep"
          tooltip="Offset added to skin thickness"
        />
      </div>

      <!-- Spar Geometry Section -->
      <div>
        <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Spar Geometry
        </h3>

        <!-- Cross-Section Type Dropdown -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            Cross-Section Type
            <span class="text-slate-400 cursor-help" title="Type of spar cross-section structure">ⓘ</span>
          </label>
          <select
            :value="modelValue.crossSection"
            @input="updateValue('crossSection', ($event.target as HTMLSelectElement).value)"
            class="block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          >
            <option value="hollow-rectangle">Hollow Rectangle</option>
            <option value="i-beam">I-Beam</option>
            <option value="c-channel">C-Channel</option>
          </select>
        </div>
        
        <!-- Spar Location (Slider) -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            Spar Location (% Chord)
            <span class="text-slate-400 cursor-help" title="Position along chord where spar is located (0 = leading edge, 1 = trailing edge)">ⓘ</span>
          </label>
          <div class="px-1">
            <input
              type="range"
              min="0.05"
              max="0.95"
              step="0.01"
              :value="modelValue.sparLocation"
              @input="updateValue('sparLocation', parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mb-2"
            />
            <div class="flex justify-between text-xs text-slate-500">
              <span>5%</span>
              <span class="font-mono bg-slate-200 px-2 rounded">
                {{ (modelValue.sparLocation * 100).toFixed(0) }}%
              </span>
              <span>95%</span>
            </div>
          </div>
        </div>

        <SchrenkInputGroup
          label="Spar Outer Width"
          name="sparWidth"
          :model-value="modelValue.sparWidth"
          @update:model-value="updateValue('sparWidth', $event)"
          :unit="lengthUnit"
          :step="lengthStep"
          tooltip="Outer width of the spar cross-section"
        />
        <SchrenkInputGroup
          :label="modelValue.crossSection === 'hollow-rectangle' ? 'Spar Wall Thickness' : modelValue.crossSection === 'i-beam' ? 'Flange/Web Thickness' : 'Flange/Web Thickness'"
          name="sparWallThickness"
          :model-value="modelValue.sparWallThickness"
          @update:model-value="updateValue('sparWallThickness', $event)"
          :unit="lengthUnit"
          :step="thicknessStep"
          :tooltip="modelValue.crossSection === 'hollow-rectangle' ? 'Wall thickness of the hollow spar tube' : modelValue.crossSection === 'i-beam' ? 'Thickness of I-beam flanges and web' : 'Thickness of C-channel flanges and web'"
        />
      </div>
    </div>
  </div>
</template>

