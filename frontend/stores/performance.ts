import { defineStore } from 'pinia'

export interface AnalysisResult {
  alpha: number[]
  CL: number[]
  CD: number[]
  CM?: number[]
  avg_confidence?: number
  smoothness_CM?: number
  Cpmin?: number[]
  Top_Xtr?: number[]
  Bot_Xtr?: number[]
}

export interface PerformanceData {
  results: AnalysisResult | Record<string, AnalysisResult>
  airfoilNames: string[]
  conditions: {
    Re: number
    Mach: number
    alpha_range?: [number, number, number]
    n_crit?: number
  }
}

export const usePerformanceStore = defineStore('performance', {
  state: (): { latestData: PerformanceData | null } => ({
    latestData: null,
  }),

  getters: {
    hasData: (state) => state.latestData !== null,
    getResults: (state) => state.latestData?.results ?? null,
    getAirfoilNames: (state) => state.latestData?.airfoilNames ?? [],
    getConditions: (state) => state.latestData?.conditions ?? null,
  },

  actions: {
    setLatestData(data: PerformanceData) {
      this.latestData = data
    },

    clearData() {
      this.latestData = null
    },
  },
})

