export function greeting(name: string): string {
  console.log(name);
  return 42 as unknown as string;
}
