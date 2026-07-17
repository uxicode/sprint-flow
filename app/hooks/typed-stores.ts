import { useUiStore } from '../stores/ui-store';
import { useSettingsStore } from '../stores/settings-store';
import { useFilterStore } from '../stores/filter-store';
import { useReportStore } from '../stores/report-store';
import type {
  FilterStoreSlice,
  ReportStoreSlice,
  SettingsStoreSlice,
  UiStoreSlice,
} from '../types';

export const useTypedUiStore = useUiStore as <T>(selector: (state: UiStoreSlice) => T) => T;
export const useTypedSettingsStore = useSettingsStore as <T>(selector: (state: SettingsStoreSlice) => T) => T;
export const useTypedFilterStore = useFilterStore as <T>(selector: (state: FilterStoreSlice) => T) => T;
export const useTypedReportStore = useReportStore as <T>(selector: (state: ReportStoreSlice) => T) => T;

export function getTypedUiStore(): UiStoreSlice {
  return useUiStore.getState() as UiStoreSlice;
}

export function getTypedSettingsStore(): SettingsStoreSlice {
  return useSettingsStore.getState() as SettingsStoreSlice;
}

export function getTypedFilterStore(): FilterStoreSlice {
  return useFilterStore.getState() as FilterStoreSlice;
}
