export function fnJoin(strings: string[], ...values: any[]) {
  const join = [];

  for (let i = 0; i < strings.length; i++) {
    if (strings[i].length) {
      join.push(strings[i]);
    }

    if (i < values.length) {
      join.push(values[i]);
    }
  }

  return {
    'Fn::Join': ['', join],
  };
}
