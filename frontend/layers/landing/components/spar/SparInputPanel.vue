<script setup lang="ts">
import type { SparInputs } from '~/types/spar.types'
import SchrenkInputGroup from '~/layers/landing/components/schrenk/SchrenkInputGroup.vue'
import { tabButtonClasses } from '~/layers/ui/utils/buttons'

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

// Unit label
const lengthUnit = computed(() => props.modelValue.unitSystem)
const unitOptions = [
  { value: 'mm', title: 'Millimeters' },
  { value: 'in', title: 'Inches' },
  { value: 'm', title: 'Meters' },
  { value: 'ft', title: 'Feet' },
] as const
</script>

<template>
  <VPanel title="Parameters">
    <div class="space-y-3">
      <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <span id="spar-unit-label" class="flex items-center gap-1 text-sm text-gray-700">
          Units
          <span class="cursor-help text-gray-400" title="Choose length units for all measurements">
            <Icon name="heroicons:information-circle" class="h-4 w-4" aria-hidden="true" />
          </span>
        </span>
        <div class="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-labelledby="spar-unit-label">
          <button
            v-for="u in unitOptions"
            :key="u.value"
            type="button"
            :title="u.title"
            :class="tabButtonClasses(modelValue.unitSystem === u.value)"
            :aria-pressed="modelValue.unitSystem === u.value"
            @click="updateValue('unitSystem', u.value)"
          >
            {{ u.value }}
          </button>
        </div>
      </div>

      <SchrenkInputGroup
        label="Chord Length"
        name="chordLength"
        :model-value="modelValue.chordLength"
        :unit="lengthUnit"
        tooltip="Total chord length of the airfoil"
        @update:model-value="updateValue('chordLength', $event)"
      />
      <SchrenkInputGroup
        label="Skin Thickness"
        name="skinThickness"
        :model-value="modelValue.skinThickness"
        :unit="lengthUnit"
        tooltip="Thickness of the airfoil skin material"
        @update:model-value="updateValue('skinThickness', $event)"
      />
      <SchrenkInputGroup
        label="Skin Offset"
        name="skinOffset"
        :model-value="modelValue.skinOffset"
        :unit="lengthUnit"
        tooltip="Offset added to skin thickness"
        @update:model-value="updateValue('skinOffset', $event)"
      />
    </div>

    <h3 class="mb-3 mt-5 border-t border-gray-200 pt-4 text-sm font-semibold text-gray-900">
      Spar geometry
    </h3>
    <div class="space-y-3">
      <div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <label for="spar-cross-section" class="flex items-center gap-1 text-sm text-gray-700">
          Cross-section
          <span class="cursor-help text-gray-400" title="Type of spar cross-section structure">
            <Icon name="heroicons:information-circle" class="h-4 w-4" aria-hidden="true" />
          </span>
        </label>
        <select
          id="spar-cross-section"
          :value="modelValue.crossSection"
          class="block h-9 w-full rounded-lg border-gray-300 py-0 pl-3 pr-8 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500"
          @input="updateValue('crossSection', ($event.target as HTMLSelectElement).value)"
        >
          <option value="hollow-rectangle">
            Hollow Rectangle
          </option>
          <option value="i-beam">
            I-Beam
          </option>
          <option value="c-channel">
            C-Channel
          </option>
        </select>
      </div>

      <div>
        <div class="mb-1 flex items-center justify-between gap-3">
          <label for="spar-location" class="flex items-center gap-1 text-sm text-gray-700">
            Spar location
            <span class="cursor-help text-gray-400" title="Position along chord where spar is located (0 = leading edge, 1 = trailing edge)">
              <Icon name="heroicons:information-circle" class="h-4 w-4" aria-hidden="true" />
            </span>
          </label>
          <span class="num text-sm text-gray-900">{{ (modelValue.sparLocation * 100).toFixed(0) }}% c</span>
        </div>
        <input
          id="spar-location"
          type="range"
          min="0.05"
          max="0.95"
          step="0.01"
          :value="modelValue.sparLocation"
          class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          @input="updateValue('sparLocation', parseFloat(($event.target as HTMLInputElement).value))"
        >
        <div class="num mt-1 flex justify-between text-xs text-gray-500">
          <span>5%</span>
          <span>95%</span>
        </div>
      </div>

      <SchrenkInputGroup
        label="Spar Outer Width"
        name="sparWidth"
        :model-value="modelValue.sparWidth"
        :unit="lengthUnit"
        tooltip="Outer width of the spar cross-section"
        @update:model-value="updateValue('sparWidth', $event)"
      />
      <SchrenkInputGroup
        :label="modelValue.crossSection === 'hollow-rectangle' ? 'Spar Wall Thickness' : 'Flange/Web Thickness'"
        name="sparWallThickness"
        :model-value="modelValue.sparWallThickness"
        :unit="lengthUnit"
        :tooltip="modelValue.crossSection === 'hollow-rectangle' ? 'Wall thickness of the hollow spar tube' : modelValue.crossSection === 'i-beam' ? 'Thickness of I-beam flanges and web' : 'Thickness of C-channel flanges and web'"
        @update:model-value="updateValue('sparWallThickness', $event)"
      />
    </div>
  </VPanel>
</template>
