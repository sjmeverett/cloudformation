export function fnSub(str: string): string {
  return { 'Fn::Sub': [str] } as any;
}
