/** Late-bound app hooks so modules can trigger renders and navigation without importing main.ts. */
export const bus = {
  refresh: (_o?: { shell?: boolean; animate?: boolean }) => {},
  navigate: (_page: string, _sub?: string) => {},
};
