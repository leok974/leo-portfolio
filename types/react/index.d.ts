/**
 * Type compatibility layer for Preact/React interop
 * Makes TS resolve React imports to Preact's compat layer
 */

declare module 'react' {
  export * from 'preact/compat';
  export { default } from 'preact/compat';
}

declare module 'react-dom' {
  export * from 'preact/compat';
  export { default } from 'preact/compat';
}

declare module 'react-dom/client' {
  import { VNode } from 'preact';
  import { ComponentChildren } from 'preact';
  
  export interface Root {
    render(children: ComponentChildren): void;
    unmount(): void;
  }
  
  export function createRoot(container: Element | Document | ShadowRoot | DocumentFragment): Root;
  export function hydrateRoot(container: Element | Document, initialChildren: ComponentChildren): Root;
}