export function fnSub(str: string, vars?: Record<string, string>): string {
  return { 'Fn::Sub': vars ? [str, vars] : [str] } as any;
}
