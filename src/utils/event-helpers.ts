/**
 * Utility functions for type-safe event handling in Preact components
 * Preact events are thin wrappers over native events, so currentTarget has the exact element type
 */

export function targetAs<T extends EventTarget>(e: Event): T {
  return e.target as T;
}

export function currentTargetAs<T extends EventTarget>(e: Event): T {
  return e.currentTarget as T;
}

/**
 * Get value from input/select/textarea element
 */
export function inputValue(e: Event): string {
  return (e.currentTarget as HTMLInputElement).value;
}

/**
 * Get checked state from checkbox element
 */
export function inputChecked(e: Event): boolean {
  return (e.currentTarget as HTMLInputElement).checked;
}

/**
 * Get files from file input element
 */
export function inputFiles(e: Event): FileList | null {
  return (e.currentTarget as HTMLInputElement).files;
}

/**
 * Get numeric value from input element
 */
export function inputValueAsNumber(e: Event): number {
  return (e.currentTarget as HTMLInputElement).valueAsNumber;
}

/**
 * Get selected options from select element
 */
export function selectValue(e: Event): string {
  return (e.currentTarget as HTMLSelectElement).value;
}
