/// <reference types="expo/types" />

// Runtime-dependent globals (Hermes provides atob; Node provides Buffer in tooling)
declare const atob: undefined | ((data: string) => string);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Buffer: any;
