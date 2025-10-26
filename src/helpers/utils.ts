export function queryParamToNumber(
  query: any,
  defaultValue?: number,
  validator?: (val: number) => boolean
): number {
  const queryValue = parseInt(query as string);
  if (!queryValue || (validator !== undefined && !validator(queryValue)))
    return defaultValue ?? 0;
  return queryValue;
}

export function stringMatches(
  searchString: string,
  searchToken: string
): boolean {
  return searchString.toLowerCase().includes(searchToken.toLowerCase());
}
