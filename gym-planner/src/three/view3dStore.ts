import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CameraPreset = 'iso' | 'top' | 'entrance';

/** Lokaler Zustand der 3D-Vorschau (Schalter, Kamera-Presets). Nicht in der Undo-Historie. */
export interface View3dState {
  showSafetyZones: boolean;
  showLabels: boolean;
  showCeilings: boolean;
  showRooms: boolean;
  shadows: boolean;
  setShowSafetyZones: (v: boolean) => void;
  setShowLabels: (v: boolean) => void;
  setShowCeilings: (v: boolean) => void;
  setShowRooms: (v: boolean) => void;
  setShadows: (v: boolean) => void;
  /** Kamera-Preset anfordern (nonce erzwingt erneutes Anwenden). */
  cameraRequest: { preset: CameraPreset; nonce: number };
  requestCamera: (preset: CameraPreset) => void;
}

export const useView3dStore = create<View3dState>()(
  persist(
    (set) => ({
      showSafetyZones: true,
      showLabels: false,
      showCeilings: false,
      showRooms: true,
      shadows: false,
      setShowSafetyZones: (showSafetyZones) => set({ showSafetyZones }),
      setShowLabels: (showLabels) => set({ showLabels }),
      setShowCeilings: (showCeilings) => set({ showCeilings }),
      setShowRooms: (showRooms) => set({ showRooms }),
      setShadows: (shadows) => set({ shadows }),
      cameraRequest: { preset: 'iso', nonce: 0 },
      requestCamera: (preset) => set((s) => ({ cameraRequest: { preset, nonce: s.cameraRequest.nonce + 1 } })),
    }),
    {
      name: 'gymplanner-view3d',
      partialize: (s) => ({
        showSafetyZones: s.showSafetyZones,
        showLabels: s.showLabels,
        showCeilings: s.showCeilings,
        showRooms: s.showRooms,
        shadows: s.shadows,
      }),
    },
  ),
);
